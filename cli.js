#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
	lstat,
	open,
	readFile,
	rename,
	stat,
	unlink,
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { errorCodes } from './lib/errors.js';
import { createOperation, maximumInputSize } from './lib/optimize.js';

const exitCodes = {
	optimization: 1,
	usage: 2,
	filesystem: 3,
	runtime: 4,
	SIGINT: 130,
	SIGTERM: 143,
};

const signalState = {
	receivedSignal: undefined,
	isForceExitArmed: false,
	reject: undefined,
	cancellationPromise: Promise.resolve(),
	cancelCurrentOperation: async () => {},
};

class CliError extends Error {
	constructor(message, exitCode, cause) {
		super(message, cause === undefined ? undefined : { cause });
		this.exitCode = exitCode;
	}
}

class SignalError extends Error {
	constructor(signal) {
		super(`Interrupted by ${signal}`);
		this.signal = signal;
	}
}

function usageError(message) {
	return new CliError(
		`${message}\nRun "gifsicle --help" for usage.`,
		exitCodes.usage,
	);
}

function parseInteger(name, value, minimum, maximum) {
	if (!/^(?:0|[1-9]\d*)$/.test(value)) {
		throw usageError(`--${name} must be a canonical decimal integer`);
	}
	const number = Number(value);
	if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
		throw usageError(`--${name} must be between ${minimum} and ${maximum}`);
	}
	return number;
}

function parseGamma(value) {
	if (value === 'srgb' || value === 'oklab') {
		return value;
	}
	if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?$/i.test(value)) {
		throw usageError('--gamma must be srgb, oklab, or a positive decimal number');
	}
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0) {
		throw usageError('--gamma must be greater than zero and finite');
	}
	return number;
}

function parseArguments(arguments_) {
	const options = {};
	const operands = [];
	const seen = new Set();
	let informational;
	let isParsingOptions = true;
	let isOptionsEndedExplicitly = false;

	const markSeen = (name) => {
		if (seen.has(name)) {
			throw usageError(`Option --${name} may only be specified once`);
		}
		seen.add(name);
	};
	const requiredValue = (argument, index, name) => {
		const equalsIndex = argument.indexOf('=');
		if (equalsIndex !== -1) {
			const value = argument.slice(equalsIndex + 1);
			if (value.length === 0) {
				throw usageError(`Option --${name} requires a value`);
			}
			return { value, index };
		}
		const value = arguments_[index + 1];
		if (value === undefined || value.startsWith('-')) {
			throw usageError(`Option --${name} requires a value`);
		}
		return { value, index: index + 1 };
	};

	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index];
		if (isParsingOptions && argument === '--') {
			isParsingOptions = false;
			isOptionsEndedExplicitly = true;
			continue;
		}
		if (!isParsingOptions || operands.length > 0 || !argument.startsWith('--')) {
			if (!isOptionsEndedExplicitly && operands.length > 0 && argument.startsWith('--')) {
				throw usageError('Options must precede operands');
			}
			operands.push(argument);
			isParsingOptions = false;
			continue;
		}

		const equalsIndex = argument.indexOf('=');
		const name = argument.slice(2, equalsIndex === -1 ? undefined : equalsIndex);
		const hasValue = equalsIndex !== -1;
		if (name === 'help' || name === 'version') {
			markSeen(name);
			if (hasValue) {
				throw usageError(`Option --${name} does not take a value`);
			}
			informational = name;
			continue;
		}

		if (name === 'optimize' || name === 'no-optimize') {
			markSeen('optimize');
			if (name === 'no-optimize') {
				if (hasValue) {
					throw usageError('Option --no-optimize does not take a value');
				}
				options.optimize = false;
			} else {
				options.optimize = hasValue
					? parseInteger('optimize', argument.slice(equalsIndex + 1), 0, 3)
					: 1;
			}
			continue;
		}

		if (name === 'careful' || name === 'no-careful') {
			markSeen('careful');
			if (hasValue) {
				throw usageError(`Option --${name} does not take a value`);
			}
			options.careful = name === 'careful';
			continue;
		}

		if (name === 'colors' || name === 'no-colors') {
			markSeen('colors');
			if (name === 'no-colors') {
				if (hasValue) {
					throw usageError('Option --no-colors does not take a value');
				}
				options.colors = false;
			} else {
				const parsed = requiredValue(argument, index, name);
				index = parsed.index;
				options.colors = parseInteger(name, parsed.value, 2, 256);
			}
			continue;
		}

		if (name === 'lossy') {
			markSeen(name);
			options.lossy = hasValue
				? parseInteger(name, argument.slice(equalsIndex + 1), 0, 2_147_483_647)
				: 20;
			continue;
		}

		if (name === 'gamma') {
			markSeen(name);
			const parsed = requiredValue(argument, index, name);
			index = parsed.index;
			options.gamma = parseGamma(parsed.value);
			continue;
		}

		throw usageError(`Unknown option: --${name}`);
	}

	if (informational) {
		if (seen.size !== 1 || operands.length > 0) {
			throw usageError('--help and --version must be used alone');
		}
		return { informational, operands, options };
	}
	if (operands.length === 0 || operands.length > 2) {
		throw usageError('Expected one input operand and at most one output operand');
	}
	return { informational, operands, options };
}

function helpText() {
	return `Gifsicle GIF optimizer

Usage:
  gifsicle [options] <input> [output]
  gifsicle [options] - - < input.gif > output.gif

Operands:
  input                 GIF filename, or - for standard input
  output                GIF filename, or - for standard output (default: -)

Options:
  --optimize[=LEVEL]     Optimize at level 1, or at LEVEL from 0 to 3
  --no-optimize          Disable optimization
  --careful              Write compatibility-oriented output
  --no-careful           Disable careful output
  --colors VALUE         Reduce palettes to 2 through 256 colors
  --no-colors            Disable palette reduction
  --lossy[=VALUE]        Use lossy optimization (default value: 20)
  --gamma VALUE          Set positive numeric, srgb, or oklab gamma
  --help                 Print this help
  --version              Print the embedded Gifsicle version
`;
}

function throwIfSignalled() {
	if (signalState.receivedSignal) {
		throw new SignalError(signalState.receivedSignal);
	}
}

async function readBounded(stream) {
	const chunks = [];
	let size = 0;
	signalState.cancelCurrentOperation = async () => {
		stream.destroy(new SignalError(signalState.receivedSignal));
	};
	try {
		for await (const chunk of stream) {
			size += chunk.byteLength;
			if (size > maximumInputSize) {
				throw new CliError(
					`GIF input exceeds the ${maximumInputSize}-byte limit`,
					exitCodes.optimization,
				);
			}
			chunks.push(chunk);
		}
	} finally {
		await signalState.cancellationPromise;
		signalState.cancelCurrentOperation = async () => {};
	}
	throwIfSignalled();
	return Buffer.concat(chunks, size);
}

async function readInput(inputPath) {
	try {
		if (inputPath === '-') {
			return await readBounded(process.stdin);
		}
		const inputStatistics = await stat(inputPath);
		if (!inputStatistics.isFile()) {
			return await readBounded(createReadStream(inputPath));
		}
		if (inputStatistics.size > maximumInputSize) {
			throw new CliError(
				`GIF input exceeds the ${maximumInputSize}-byte limit`,
				exitCodes.optimization,
			);
		}
		const abortController = new AbortController();
		signalState.cancelCurrentOperation = async () => abortController.abort();
		let input;
		try {
			input = await readFile(inputPath, { signal: abortController.signal });
		} finally {
			await signalState.cancellationPromise;
			signalState.cancelCurrentOperation = async () => {};
		}
		throwIfSignalled();
		return input;
	} catch (error) {
		if (error instanceof CliError || error instanceof SignalError) {
			throw error;
		}
		throw new CliError(`Could not read GIF input: ${error.message}`, exitCodes.filesystem, error);
	}
}

async function outputStatistics(outputPath) {
	try {
		const statistics = await lstat(outputPath);
		if (!statistics.isFile()) {
			throw new CliError(
				statistics.isDirectory()
					? 'Output path is a directory'
					: 'Symbolic links and special files cannot be used as output',
				exitCodes.filesystem,
			);
		}
		return statistics;
	} catch (error) {
		if (error?.code === 'ENOENT') {
			return;
		}
		throw error;
	}
}

function temporaryPath(outputPath) {
	const directory = path.dirname(outputPath);
	const basename = path.basename(outputPath);
	return path.join(directory, `.${basename}.${process.pid}.${randomUUID()}.tmp`);
}

async function ignoreErrors(operation) {
	try {
		await operation();
	} catch {
		// Cleanup is best effort and must not hide the original failure.
	}
}

async function preflightOutput(outputPath) {
	if (outputPath === '-') {
		if (process.stdout.isTTY) {
			throw new CliError(
				'Refusing to write binary GIF data to a terminal',
				exitCodes.filesystem,
			);
		}
		return;
	}
	let handle;
	let temporary;
	const cleanUp = async () => {
		if (handle) {
			await ignoreErrors(() => handle.close());
			handle = undefined;
		}
		if (temporary) {
			await ignoreErrors(() => unlink(temporary));
		}
	};
	signalState.cancelCurrentOperation = cleanUp;
	try {
		const currentOutput = await outputStatistics(outputPath);
		if (currentOutput && (currentOutput.mode & 0o222) === 0) {
			throw new CliError(
				'Existing output file is not writable',
				exitCodes.filesystem,
			);
		}
		temporary = temporaryPath(outputPath);
		handle = await open(temporary, 'wx', 0o600);
		await handle.close();
		handle = undefined;
		await unlink(temporary);
		temporary = undefined;
	} catch (error) {
		if (error instanceof CliError || error instanceof SignalError) {
			throw error;
		}
		throw new CliError(`Cannot write output: ${error.message}`, exitCodes.filesystem, error);
	} finally {
		await signalState.cancellationPromise;
		await cleanUp();
		signalState.cancelCurrentOperation = async () => {};
	}
	throwIfSignalled();
}

async function writeStandardOutput(output) {
	await new Promise((resolve, reject) => {
		let isSettled = false;
		const onError = (error) => {
			if (isSettled) {
				return;
			}

			isSettled = true;
			reject(error);
		};
		const onComplete = (error) => {
			if (error) {
				onError(error);
			} else if (!isSettled) {
				isSettled = true;
				resolve();
			}
		};
		process.stdout.on('error', onError);
		process.stdout.write(output, onComplete);
	});
}

async function writeFileAtomically(outputPath, output) {
	const temporary = temporaryPath(outputPath);
	let handle;
	let isRenamed = false;
	const cleanUp = async () => {
		if (handle) {
			await ignoreErrors(() => handle.close());
			handle = undefined;
		}
		if (!isRenamed) {
			await ignoreErrors(() => unlink(temporary));
		}
	};
	signalState.cancelCurrentOperation = cleanUp;
	try {
		handle = await open(temporary, 'wx', 0o600);
		await handle.writeFile(output);
		await handle.sync();
		const currentOutput = await outputStatistics(outputPath);
		const mode = currentOutput
			? currentOutput.mode & 0o777
			: 0o666 & ~process.umask();
		await handle.chmod(mode);
		await handle.close();
		handle = undefined;
		throwIfSignalled();
		await rename(temporary, outputPath);
		isRenamed = true;
		throwIfSignalled();
	} finally {
		await signalState.cancellationPromise;
		await cleanUp();
		signalState.cancelCurrentOperation = async () => {};
	}
}

async function writeOutput(outputPath, output) {
	try {
		if (outputPath === '-') {
			signalState.cancelCurrentOperation = async () => process.stdout.destroy();
			try {
				await writeStandardOutput(output);
			} finally {
				await signalState.cancellationPromise;
				signalState.cancelCurrentOperation = async () => {};
			}
			throwIfSignalled();
			return;
		}
		await writeFileAtomically(outputPath, output);
	} catch (error) {
		if (error instanceof CliError || error instanceof SignalError) {
			throw error;
		}
		throw new CliError(`Could not write GIF output: ${error.message}`, exitCodes.filesystem, error);
	}
}

function optimizationExitCode(error) {
	return [errorCodes.WASM_OUT_OF_MEMORY, errorCodes.WORKER_FAILED].includes(error?.code)
		? exitCodes.runtime
		: exitCodes.optimization;
}

function forceExit(signal) {
	// A second signal intentionally bypasses asynchronous cleanup.
	// eslint-disable-next-line n/no-process-exit
	process.exit(exitCodes[signal]);
}

function handleSignal(signal) {
	if (signalState.isForceExitArmed) {
		forceExit(signal);
		return;
	}
	signalState.isForceExitArmed = true;
	process.off('SIGINT', handleSignal);
	process.off('SIGTERM', handleSignal);
	process.on('SIGINT', forceExit);
	process.on('SIGTERM', forceExit);
	signalState.receivedSignal = signal;
	process.exitCode = exitCodes[signal];
	signalState.reject?.(new SignalError(signal));
	const cancel = signalState.cancelCurrentOperation;
	signalState.cancellationPromise = (async () => cancel())();
}

async function main() {
	const { informational, operands, options } = parseArguments(process.argv.slice(2));
	if (informational === 'help') {
		await writeStandardOutput(helpText());
		return;
	}
	if (informational === 'version') {
		await writeStandardOutput('1.96\n');
		return;
	}

	const [inputPath, outputPath = '-'] = operands;
	await preflightOutput(outputPath);
	throwIfSignalled();
	const input = await readInput(inputPath);
	throwIfSignalled();
	const operation = createOperation(input, options);
	signalState.cancelCurrentOperation = operation.terminate;
	const { promise: signalPromise, reject } = Promise.withResolvers();
	signalState.reject = reject;
	let output;
	try {
		output = await Promise.race([operation.promise, signalPromise]);
	} catch (error) {
		if (error instanceof SignalError) {
			throw error;
		}
		throw new CliError(error.message, optimizationExitCode(error), error);
	} finally {
		signalState.reject = undefined;
		await signalState.cancellationPromise;
		signalState.cancelCurrentOperation = async () => {};
	}
	throwIfSignalled();
	await writeOutput(outputPath, output);
}

process.on('SIGINT', handleSignal);
process.on('SIGTERM', handleSignal);

try {
	await main();
} catch (error) {
	if (error instanceof SignalError || signalState.receivedSignal) {
		process.exitCode = exitCodes[signalState.receivedSignal ?? error.signal];
	} else {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = error.exitCode ?? exitCodes.runtime;
	}
}
