/// <reference types="node" />

export interface OptimizeOptions {
	readonly optimize?: false | 0 | 1 | 2 | 3;
	readonly careful?: boolean;
	readonly colors?: false | number;
	readonly lossy?: false | number;
	readonly gamma?: false | number | 'srgb' | 'oklab';
}

export type GifsicleErrorCode =
	| 'INVALID_INPUT'
	| 'INVALID_OPTIONS'
	| 'PROCESSING_FAILED'
	| 'WASM_OUT_OF_MEMORY'
	| 'WORKER_FAILED';

export declare const errorCodes: Readonly<{
	INVALID_INPUT: 'INVALID_INPUT';
	INVALID_OPTIONS: 'INVALID_OPTIONS';
	PROCESSING_FAILED: 'PROCESSING_FAILED';
	WASM_OUT_OF_MEMORY: 'WASM_OUT_OF_MEMORY';
	WORKER_FAILED: 'WORKER_FAILED';
}>;

export declare function optimize(
	input: Buffer | Uint8Array,
	options?: OptimizeOptions,
): Promise<Buffer>;

export default optimize;
