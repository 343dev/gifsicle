#!/usr/bin/env node

import { spawn } from 'node:child_process';

import binaryPath from './index.js';

const programArguments = process.argv.slice(2);

spawn(binaryPath, programArguments, { stdio: 'inherit' })
	.on('exit', process.exit);
