import fs from 'node:fs';
import path from 'node:path';
import { arch, platform } from 'node:process';
import { fileURLToPath } from 'node:url';

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

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const binaryName = `gifsicle_${arch}${platform === 'win32' ? '.exe' : ''}`;
const binaryPath = path.join(dirname, 'vendor', platform, binaryName);

await fs.promises.access(binaryPath);

export default binaryPath;
