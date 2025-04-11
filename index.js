import path from 'node:path';
import { arch, platform } from 'node:process';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const binaryName = `gifsicle_${arch}${platform === 'win32' ? '.exe' : ''}`;
const binaryPath = path.join(dirname, 'vendor', platform, binaryName);

export default binaryPath;
