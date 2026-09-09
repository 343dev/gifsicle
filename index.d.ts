/// <reference types="node" />

export interface OptimizeOptions {
	/** Optimization level: `false` or an integer from 0 through 3. @default 0 */
	readonly optimize?: false | 0 | 1 | 2 | 3;
	/** Preserve interlacing and avoid optimizations that may add artifacts. @default false */
	readonly careful?: boolean;
	/** Palette size: `false` or an integer from 2 through 256. @default false */
	readonly colors?: false | number;
	/** Lossy compression amount: `false` or an integer from 0 through 2147483647. @default false */
	readonly lossy?: false | number;
	/** Color quantization gamma: `false`, a positive finite number, `'srgb'`, or `'oklab'`. @default 'srgb' */
	readonly gamma?: false | number | 'srgb' | 'oklab';
}

export type GifsicleErrorCode =
	| 'INVALID_INPUT'
	| 'INVALID_OPTIONS'
	| 'PROCESSING_FAILED'
	| 'WASM_OUT_OF_MEMORY'
	| 'WORKER_FAILED';

export declare const errorCodes: {
	readonly [Code in GifsicleErrorCode]: Code;
};

export interface GifsicleError extends Error {
	readonly code: GifsicleErrorCode;
}

/** @throws {GifsicleError} */
export declare function optimize(
	input: Buffer | Uint8Array,
	options?: OptimizeOptions,
): Promise<Buffer>;

export default optimize;
