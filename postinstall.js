#!/usr/bin/env node

import fs from 'node:fs';
import { arch, platform } from 'node:process';

import binaryPath from './index.js';

const supported = {
	arch: ['arm64', 'x64'],
	platform: ['darwin', 'linux', 'win32'],
};

if (!supported.arch.includes(arch)) {
	throw new Error(`"${arch}" CPU architecture is not supported`);
}

if (!supported.platform.includes(platform)) {
	throw new Error(`"${platform}" OS platform is not supported`);
}

await fs.promises.access(binaryPath);
