import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const npmCliPath = process.env.npm_execpath ?? process.env.npm_node_execpath;

async function command(file, arguments_, options = {}) {
	return execFileAsync(file, arguments_, {
		encoding: 'utf8',
		env: {
			...process.env,
			npm_config_allow_scripts: '',
		},
		maxBuffer: 32 * 1024 * 1024,
		...options,
	});
}

test('the npm artifact installs and runs without lifecycle scripts', { timeout: 120_000 }, async () => {
	assert.ok(npmCliPath, 'npm_execpath must be set by the npm test command');
	const staging = await mkdtemp(path.join(tmpdir(), 'gifsicle-pack-'));
	const installation = path.join(staging, 'installation');
	const { stdout } = await command(process.execPath, [
		npmCliPath,
		'pack',
		rootPath,
		'--json',
		'--pack-destination',
		staging,
	]);
	const packed = JSON.parse(stdout);
	const [{ filename, files }] = Array.isArray(packed) ? packed : Object.values(packed);
	const names = files.map(file => file.path);

	for (const required of [
		'dist/gifsicle.mjs',
		'dist/gifsicle.wasm',
		'lib/optimize.js',
		'lib/worker.js',
		'src/wasm/config.h',
		'src/wasm/native-driver.c',
		'src/wasm/stable-qsort.c',
		'scripts/benchmark.js',
		'scripts/build-native.sh',
		'scripts/build-wasm.sh',
		'scripts/emsdk-version.sh',
		'scripts/native-reference.js',
		'scripts/setup-emsdk.sh',
		'scripts/verify-dist.sh',
		'scripts/verify-native-sanitizers.sh',
		'scripts/verify-parity.js',
		'scripts/verify-patch.sh',
		'scripts/verify-upstream.js',
		'verification/benchmark.json',
		'verification/native-reference.md',
		'verification/parity-manifest.json',
		'upstream/gifsicle-wasm.patch',
		'upstream/gifsicle.sha256',
		'upstream/gifsicle.modes',
		'upstream/gifsicle/COPYING',
		'cli.js',
		'index.js',
		'index.d.ts',
		'LICENSE',
		'README.md',
		'MIGRATION.md',
		'UPSTREAM.md',
		'THIRD_PARTY_NOTICES.md',
		'package.json',
	]) {
		assert.ok(names.includes(required), `missing ${required}`);
	}
	assert.ok(names.every(name => !name.startsWith('vendor/')));
	assert.ok(names.every(name => !name.startsWith('.cache/') && !name.startsWith('test/')));
	assert.ok(names.every(name => !name.endsWith('.map') && !name.endsWith('.debug') && !name.endsWith('.o')));
	assert.ok(names.every(name => !/(?:^|\/)gifsicle-native(?:\.exe)?$/.test(name)));
	assert.ok(names.every(name => !/(?:^|\/)(?:benchmark-inputs?|bench-fixtures?)(?:\/|$)/.test(name)));
	assert.ok(names.every(name => !name.endsWith('.tmp')));

	await writeFile(path.join(staging, 'package.json'), '{"private":true}');
	await command(process.execPath, [
		npmCliPath,
		'install',
		'--ignore-scripts',
		'--no-audit',
		'--no-fund',
		'--prefix',
		installation,
		path.join(staging, filename),
	]);

	const fixturePath = fileURLToPath(new URL('fixtures/animated.gif', import.meta.url));
	const smoke = `
		import optimize, { errorCodes, optimize as namedOptimize } from '@343dev/gifsicle';
		import { readFile } from 'node:fs/promises';
		if (optimize !== namedOptimize || !Object.isFrozen(errorCodes)) throw new Error('bad exports');
		const output = await optimize(await readFile(${JSON.stringify(fixturePath)}));
		if (!Buffer.isBuffer(output) || output.length !== 8703) throw new Error('unexpected output');
	`;
	await command(process.execPath, ['--input-type=module', '--eval', smoke], { cwd: installation });

	const { stdout: version } = await command(process.execPath, [
		npmCliPath,
		'exec',
		'--offline',
		'--prefix',
		installation,
		'--',
		'gifsicle',
		'--version',
	]);
	assert.equal(version, '1.96\n');

	await assert.rejects(
		command(process.execPath, [
			'--input-type=module',
			'--eval',
			'import \'@343dev/gifsicle/lib/optimize.js\'',
		], { cwd: installation }),
		error => error.stderr.includes('ERR_PACKAGE_PATH_NOT_EXPORTED'),
	);
	const distributionFiles = await readdir(
		path.join(installation, 'node_modules/@343dev/gifsicle/dist'),
	);
	assert.deepEqual(
		distributionFiles.toSorted((first, second) => first.localeCompare(second)),
		['gifsicle.mjs', 'gifsicle.wasm'],
	);
	const installedPackageBytes = await readFile(
		path.join(installation, 'node_modules/@343dev/gifsicle/package.json'),
		'utf8',
	);
	const installedPackage = JSON.parse(installedPackageBytes);
	for (const lifecycle of [
		'preinstall',
		'install',
		'postinstall',
		'prepare',
		'prepack',
		'postpack',
		'prepublish',
		'prepublishOnly',
		'publish',
		'postpublish',
	]) {
		assert.equal(installedPackage.scripts?.[lifecycle], undefined);
	}
	assert.equal('dependencies' in installedPackage, false);
});
