import optimize, {
	errorCodes,
	optimize as namedOptimize,
	type GifsicleError,
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
const error = new Error('invalid') as GifsicleError;
const errorCode: GifsicleErrorCode = error.code;
const errorCodeKeys: GifsicleErrorCode[] = [
	errorCodes.INVALID_INPUT,
	errorCodes.INVALID_OPTIONS,
	errorCodes.PROCESSING_FAILED,
	errorCodes.WASM_OUT_OF_MEMORY,
	errorCodes.WORKER_FAILED,
];

void output;
void namedOutput;
void code;
void errorCode;
void errorCodeKeys;

// @ts-expect-error unsupported option
void optimize(input, { threads: 4 });
// @ts-expect-error invalid optimization level
void optimize(input, { optimize: 4 });
// @ts-expect-error input must contain bytes
void optimize('GIF89a');
