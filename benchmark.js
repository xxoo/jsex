'use strict';

require('./jsex.js');

const makeCases = () => [
	{
		name: 'flat numbers',
		iterations: 1000,
		source: '[' + Array.from({ length: 1000 }, (_, i) => i).join(',') + ']'
	},
	{
		name: 'nested objects',
		iterations: 300,
		source: '[' + Array.from({ length: 300 }, (_, i) => `{"id":${i},"name":"item-${i}","ok":true,"values":[1,2,3,null]}`).join(',') + ']'
	},
	{
		name: 'escaped strings',
		iterations: 500,
		source: '[' + Array.from({ length: 500 }, (_, i) => JSON.stringify(`item-${i}\\n${i}`)).join(',') + ']'
	},
	{
		name: 'functions',
		iterations: 200,
		source: '[' + Array.from({ length: 200 }, (_, i) => `function(a){return a+${i};}`).join(',') + ']'
	},
	{
		name: 'mixed extended',
		iterations: 500,
		source: toJsex([
			1,
			-0,
			2n,
			Symbol.for('jsex-benchmark'),
			new Date(5),
			/a[,}]b/gi,
			new Set([1, 'x']),
			new Map([[1, 'one']]),
			new Uint8Array([1, 2]),
			new Float32Array([1.5, 2.5]),
			TypeError('bad')
		])
	}
];

const runCase = ({ name, source, iterations }) => {
	for (let i = 0; i < 100; ++i) {
		const result = source.parseJsex();
		if (!result || result.length !== source.length) {
			throw Error(`Warmup failed for ${name}`);
		}
	}

	const start = process.hrtime.bigint();
	for (let i = 0; i < iterations; ++i) {
		const result = source.parseJsex();
		if (!result || result.length !== source.length) {
			throw Error(`Benchmark failed for ${name}`);
		}
	}
	const ms = Number(process.hrtime.bigint() - start) / 1e6;
	const msPerOp = ms / iterations;
	const mbPerSecond = source.length * iterations / ms / 1000;

	return {
		name,
		bytes: source.length,
		iterations,
		msPerOp,
		mbPerSecond
	};
};

const pad = (value, width) => String(value).padEnd(width);

console.log([
	pad('case', 18),
	pad('bytes', 8),
	pad('iterations', 11),
	pad('ms/op', 10),
	'MB/s'
].join(''));

for (const result of makeCases().map(runCase)) {
	console.log([
		pad(result.name, 18),
		pad(result.bytes, 8),
		pad(result.iterations, 11),
		pad(result.msPerOp.toFixed(3), 10),
		result.mbPerSecond.toFixed(2)
	].join(''));
}
