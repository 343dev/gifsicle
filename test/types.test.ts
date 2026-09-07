import optimize, {
	errorCodes,
	optimize as namedOptimize,
	type GifsicleErrorCode,
	type OptimizeOptions,
} from '@343dev/gifsicle';

const input = Buffer.from('GIF89a');
const options: OptimizeOptions = {
	optimize: 3,
	careful: true,
	colors: 256,
	lossy: 100,
	gamma: 'oklab',
};
const output: Promise<Buffer> = optimize(input, options);
const namedOutput: Promise<Buffer> = namedOptimize(new Uint8Array(input));
const code: GifsicleErrorCode = errorCodes.INVALID_INPUT;

void output;
void namedOutput;
void code;

// @ts-expect-error unsupported option
void optimize(input, { threads: 4 });
// @ts-expect-error invalid optimization level
void optimize(input, { optimize: 4 });
// @ts-expect-error input must contain bytes
void optimize('GIF89a');
