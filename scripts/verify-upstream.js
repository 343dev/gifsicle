import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const upstreamRoot = new URL('../upstream/gifsicle/', import.meta.url);
const hashManifestUrl = new URL('../upstream/gifsicle.sha256', import.meta.url);
const modeManifestUrl = new URL('../upstream/gifsicle.modes', import.meta.url);

async function listFiles(directory, prefix = '') {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const relative = path.posix.join(prefix, entry.name);
		if (entry.isDirectory()) {
			files.push(...await listFiles(new URL(`${relative}/`, upstreamRoot), relative));
		} else if (entry.isFile()) {
			files.push(relative);
		} else {
			throw new Error(`Unexpected non-file in upstream snapshot: ${relative}`);
		}
	}
	return files;
}

async function readManifest(url, pattern, label) {
	const manifest = await readFile(url, 'utf8');
	const values = new Map();
	for (const line of manifest.trimEnd().split('\n')) {
		const match = pattern.exec(line);
		if (!match) {
			throw new Error(`Malformed ${label} manifest line: ${line}`);
		}
		values.set(match.groups.file, match.groups.value);
	}
	return values;
}

const expectedHashes = await readManifest(
	hashManifestUrl,
	/^(?<value>[0-9a-f]{64}) {2}(?:\.\/)?(?<file>.+)$/,
	'hash',
);
const expectedModes = await readManifest(
	modeManifestUrl,
	/^(?<value>644|755) (?<file>.+)$/,
	'mode',
);
const listedFiles = await listFiles(upstreamRoot);
const files = listedFiles.toSorted();
for (const manifest of [expectedHashes, expectedModes]) {
	if (manifest.size !== files.length || files.some(file => !manifest.has(file))) {
		throw new Error('Upstream snapshot file list differs from its manifest');
	}
}

for (const file of files) {
	const url = new URL(`upstream/gifsicle/${file}`, root);
	const bytes = await readFile(url);
	const actualHash = createHash('sha256').update(bytes).digest('hex');
	if (actualHash !== expectedHashes.get(file)) {
		throw new Error(`Upstream hash mismatch: ${file}`);
	}
	const statistics = await stat(url);
	const actualMode = statistics.mode & 0o111 ? '755' : '644';
	if (actualMode !== expectedModes.get(file)) {
		throw new Error(`Upstream mode mismatch: ${file}`);
	}
}

console.log(`Verified ${files.length} upstream Gifsicle files.`);
