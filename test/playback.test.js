import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import sharp from 'sharp';

import optimize from '../index.js';

async function decode(input) {
	const image = sharp(input, { animated: true });
	const metadata = await image.metadata();
	const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	return {
		width: metadata.width,
		pageHeight: metadata.pageHeight ?? metadata.height,
		pages: metadata.pages ?? 1,
		delays: metadata.delay ?? [0],
		loop: metadata.loop ?? 0,
		channels: info.channels,
		pixels: data,
	};
}

for (const fixture of [
	'single.gif',
	'animated.gif',
	'transparent.gif',
	'empty-transparent.gif',
	'zero-dimensions.gif',
	'extensions.gif',
	'local-palette.gif',
]) {
	test(`lossless optimization preserves independently decoded ${fixture} playback`, async () => {
		const input = await readFile(new URL(`fixtures/${fixture}`, import.meta.url));
		const output = await optimize(input, { optimize: 3 });
		const before = await decode(input);
		const after = await decode(output);
		assert.equal(after.width, before.width);
		assert.equal(after.pageHeight, before.pageHeight);
		assert.equal(after.pages, before.pages);
		assert.deepEqual(after.delays, before.delays);
		assert.equal(after.loop, before.loop);
		assert.equal(after.channels, 4);
		assert.deepEqual(after.pixels, before.pixels);
	});
}
