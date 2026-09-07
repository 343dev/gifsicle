import { execFile } from 'node:child_process';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function nativeArguments(fixture, options, output) {
	const gammaType = options.gamma === 'oklab'
		? 2
		: (typeof options.gamma === 'number' ? 1 : 0);
	return [
		fixture,
		String(options.optimize || 0),
		String(Number(options.careful || false)),
		String(options.colors || 0),
		String(options.lossy || 0),
		String(gammaType),
		String(gammaType === 1 ? options.gamma : 2.2),
		output,
	];
}

export function nativeLauncher() {
	const launcher = process.env.GIFSICLE_NATIVE_LAUNCHER
		? JSON.parse(process.env.GIFSICLE_NATIVE_LAUNCHER)
		: [];
	if (
		!Array.isArray(launcher)
		|| launcher.some(argument => typeof argument !== 'string')
		|| (
			process.env.GIFSICLE_NATIVE_LAUNCHER !== undefined
			&& launcher.length === 0
		)
	) {
		throw new Error('GIFSICLE_NATIVE_LAUNCHER must be a nonempty JSON array of strings');
	}
	return launcher;
}

export async function runNative(executable, launcher, arguments_) {
	await execFileAsync(
		launcher[0] ?? executable,
		launcher.length > 0
			? [...launcher.slice(1), executable, ...arguments_]
			: arguments_,
	);
}
