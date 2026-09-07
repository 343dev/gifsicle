import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	chmod,
	lstat,
	mkdtemp,
	readdir,
	readFile,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const cliPath = fileURLToPath(new URL('../cli.js', import.meta.url));
const fixturePath = fileURLToPath(new URL('fixtures/animated.gif', import.meta.url));
const execFileAsync = promisify(execFile);

async function run(arguments_, options = {}) {
	return new Promise((resolve, reject) => {
		const nodeArguments = options.prelude
			? [
				'--input-type=module',
				'--eval',
				`${options.prelude}; process.argv.splice(1, 0, ${JSON.stringify(cliPath)}); await import(${JSON.stringify(new URL('../cli.js', import.meta.url).href)});`,
				...arguments_,
			]
			: [cliPath, ...arguments_];
		const child = spawn(process.execPath, nodeArguments, options.spawn);
		options.onSpawn?.(child);
		const stdout = [];
		const stderr = [];
		child.stdout.on('data', chunk => stdout.push(chunk));
		child.stderr.on('data', chunk => stderr.push(chunk));
		child.once('error', reject);
		child.once('close', status => resolve({
			status,
			stdout: Buffer.concat(stdout),
			stderr: Buffer.concat(stderr),
		}));
		child.stdin.on('error', (error) => {
			if (error.code !== 'EPIPE') {
				reject(error);
			}
		});
		child.stdin.end(options.input);
	});
}

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

test('prints standalone help and embedded upstream version', async () => {
	const help = await run(['--help']);
	assert.equal(help.status, 0);
	assert.match(help.stdout.toString(), /Usage:\n {2}gifsicle/);
	assert.match(help.stdout.toString(), /--version\s+Print the embedded Gifsicle version/);
	assert.equal(help.stderr.length, 0);

	const version = await run(['--version']);
	assert.equal(version.status, 0);
	assert.equal(version.stdout.toString(), '1.96\n');
	assert.equal(version.stderr.length, 0);
});

test('uses strict option grammar and usage exit code 2', async () => {
	for (const arguments_ of [
		[],
		['--unknown'],
		['--threads=2', fixturePath],
		['--no-warnings', fixturePath],
		['--optimize=4', fixturePath],
		['--colors=01', fixturePath],
		['--lossy', fixturePath, 'output.gif', 'extra.gif'],
		['--gamma=SRGB', fixturePath],
		['--careful', '--careful', fixturePath],
		[fixturePath, '--careful'],
		['--version', fixturePath],
	]) {
		const result = await run(arguments_);
		assert.equal(result.status, 2, arguments_.join(' '));
		assert.match(result.stderr.toString(), /gifsicle --help/);
	}
});

test('supports file and standard stream operands with all option forms', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'gifsicle-cli-'));
	const outputPath = path.join(directory, 'output.gif');
	const fileResult = await run(['--optimize=2', '--colors', '128', fixturePath, outputPath]);
	assert.equal(fileResult.status, 0, fileResult.stderr.toString());
	assert.equal(fileResult.stdout.length, 0);
	const fileOutput = await readFile(outputPath);
	assert.ok(fileOutput.subarray(0, 6).toString().startsWith('GIF'));

	const input = await readFile(fixturePath);
	const streamResult = await run(['--lossy=20', '--gamma', 'srgb', '-'], { input });
	assert.equal(streamResult.status, 0, streamResult.stderr.toString());
	assert.ok(streamResult.stdout.subarray(0, 6).toString().startsWith('GIF'));
	assert.equal(streamResult.stderr.length, 0);

	const bareOptions = await run(['--optimize', '--lossy', fixturePath]);
	assert.equal(bareOptions.status, 0, bareOptions.stderr.toString());
	assert.ok(bareOptions.stdout.subarray(0, 6).toString().startsWith('GIF'));

	const disabled = await run([
		'--no-optimize', '--no-careful', '--no-colors', '--', fixturePath,
	]);
	assert.equal(disabled.status, 0, disabled.stderr.toString());
	assert.equal(
		sha256(disabled.stdout),
		'0e79171206b236d2f3e3384616c85ae4e8775708020175dcef61e3dcf1d9edd8',
	);
});

test('classifies invalid GIF and filesystem failures', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'gifsicle-errors-'));
	const invalidPath = path.join(directory, 'invalid.gif');
	await writeFile(invalidPath, 'not a gif');
	const invalid = await run([invalidPath]);
	assert.equal(invalid.status, 1);
	assert.notEqual(invalid.stderr.length, 0);

	const missing = await run([path.join(directory, 'missing.gif')]);
	assert.equal(missing.status, 3);
	assert.notEqual(missing.stderr.length, 0);
});

test('replaces regular output atomically while preserving mode', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'gifsicle-atomic-'));
	const outputPath = path.join(directory, 'output.gif');
	await writeFile(outputPath, 'existing');
	await chmod(outputPath, 0o640);

	const success = await run([fixturePath, outputPath]);
	assert.equal(success.status, 0, success.stderr.toString());
	const replacedOutput = await readFile(outputPath);
	assert.ok(replacedOutput.subarray(0, 6).toString().startsWith('GIF'));
	if (process.platform !== 'win32') {
		const outputStatistics = await lstat(outputPath);
		assert.equal(outputStatistics.mode & 0o777, 0o640);
	}

	await writeFile(outputPath, 'existing');
	const invalidPath = path.join(directory, 'invalid.gif');
	await writeFile(invalidPath, 'invalid');
	const failure = await run([invalidPath, outputPath]);
	assert.equal(failure.status, 1);
	const preservedOutput = await readFile(outputPath);
	assert.equal(preservedOutput.toString(), 'existing');
});

test('supports same-path replacement and filenames beginning with a hyphen', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'gifsicle-paths-'));
	const samePath = path.join(directory, 'same.gif');
	await writeFile(samePath, await readFile(fixturePath));
	const same = await run([samePath, samePath]);
	assert.equal(same.status, 0, same.stderr.toString());
	const sameOutput = await readFile(samePath);
	assert.ok(sameOutput.subarray(0, 6).toString().startsWith('GIF'));

	const unusualInput = path.join(directory, '-input.gif');
	const unusualOutput = path.join(directory, '-output.gif');
	const fixture = await readFile(fixturePath);
	await writeFile(unusualInput, fixture);
	const unusual = await run(['--', '-input.gif', '-output.gif'], {
		spawn: { cwd: directory },
	});
	assert.equal(unusual.status, 0, unusual.stderr.toString());
	const unusualOutputBytes = await readFile(unusualOutput);
	assert.ok(unusualOutputBytes.subarray(0, 6).toString().startsWith('GIF'));
});

test('preflights unwritable output and cleans temporary files', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'gifsicle-preflight-'));
	const outputPath = path.join(directory, 'output.gif');
	await writeFile(outputPath, 'existing');
	await chmod(outputPath, 0o444);
	const result = await run([fixturePath, outputPath]);
	assert.equal(result.status, 3);
	assert.match(result.stderr.toString(), /not writable/);
	const preserved = await readFile(outputPath);
	assert.equal(preserved.toString(), 'existing');
	const entries = await readdir(directory);
	assert.deepEqual(entries.toSorted(), ['output.gif']);
});

test('creates output with mode derived from the process umask', {
	skip: process.platform === 'win32',
}, async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'gifsicle-mode-'));
	const outputPath = path.join(directory, 'output.gif');
	const result = await run([fixturePath, outputPath], {
		prelude: 'process.umask(0o027)',
	});
	assert.equal(result.status, 0, result.stderr.toString());
	const outputStatistics = await lstat(outputPath);
	assert.equal(outputStatistics.mode & 0o777, 0o640);
});

test('refuses binary standard output connected to a terminal', {
	skip: process.platform === 'win32',
}, async () => {
	await assert.rejects(
		execFileAsync('script', [
			'-qefc',
			`${JSON.stringify(process.execPath)} ${JSON.stringify(cliPath)} ${JSON.stringify(fixturePath)}`,
			'/dev/null',
		], { encoding: 'utf8' }),
		(error) => {
			assert.equal(error.code, 3);
			assert.match(error.stdout, /Refusing to write binary GIF data to a terminal/);
			return true;
		},
	);
});

test('classifies a broken standard-output pipe as a filesystem failure', async () => {
	const input = await readFile(fixturePath);
	const result = await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [cliPath, '-']);
		const stderr = [];
		child.stdout.destroy();
		child.stderr.on('data', chunk => stderr.push(chunk));
		child.once('error', reject);
		child.once('close', status => resolve({
			status,
			stderr: Buffer.concat(stderr),
		}));
		child.stdin.end(input);
	});
	assert.equal(result.status, 3);
	assert.match(result.stderr.toString(), /EPIPE|broken pipe/i);
});

test('uses conventional exit status after a cancellation signal', async () => {
	for (const [signal, status] of [['SIGINT', 130], ['SIGTERM', 143]]) {
		const input = Buffer.alloc(32 * 1024 * 1024);
		let child;
		const resultPromise = run(['-'], {
			input,
			onSpawn: (spawned) => {
				child = spawned;
			},
		});
		await new Promise(resolve => setTimeout(resolve, 75));
		child.kill(signal);
		const result = await resultPromise;
		assert.equal(result.status, status, signal);
		assert.equal(result.stdout.length, 0);
	}
});

test('rejects symlinks and directories as output', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'gifsicle-output-'));
	const outputPath = path.join(directory, 'output.gif');
	await writeFile(outputPath, 'existing');
	const linkPath = path.join(directory, 'link.gif');
	await symlink(outputPath, linkPath);

	const link = await run([fixturePath, linkPath]);
	assert.equal(link.status, 3);
	assert.match(link.stderr.toString(), /Symbolic links and special files/);

	const directoryResult = await run([fixturePath, directory]);
	assert.equal(directoryResult.status, 3);
	assert.match(directoryResult.stderr.toString(), /Output path is a directory/);
});
