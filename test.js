const assert = require('assert');

require('./jsex.js');

const realType = value => Object.prototype.toString.call(value).slice(8, -1);
const parse = source => {
	const result = source.parseJsex();
	assert(result, 'parseJsex returned falsy for: ' + source);
	assert.strictEqual(result.length, source.length, 'length mismatch for: ' + source);
	return result.value;
};

// Helper: roundtrip — serialize then deserialize, return the value
const roundtrip = (data, options) => {
	const s = toJsex(data, options);
	if (s === undefined) return undefined;
	const r = s.parseJsex();
	return r ? r.value : undefined;
};

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
	try {
		const result = fn();
		if (result && typeof result.then === 'function') {
			return result.then(() => {
				passed++;
				console.log(`  ✓ ${name}`);
			}).catch(err => {
				failed++;
				errors.push({ name, error: err });
				console.log(`  ✗ ${name}`);
				console.log(`    ${err.message}`);
			});
		}
		passed++;
		console.log(`  ✓ ${name}`);
	} catch (err) {
		failed++;
		errors.push({ name, error: err });
		console.log(`  ✗ ${name}`);
		console.log(`    ${err.message}`);
	}
	return Promise.resolve();
}

function section(name) {
	console.log(`\n${name}`);
}

(async () => {
	// ═══════════════════════════════════════════════════════
	// ORIGINAL TESTS (preserved)
	// ═══════════════════════════════════════════════════════
	section('Original Tests — Function serialization');

	function named(a) { return a; }
	const anon = function (a) { return a; },
		arrow = async => async,
		arrowWrapped = a => (a + 1),
		arrowObject = a => ({ value: a }),
		arrowPartialParens = a => (a) + 1,
		asyncArrow = async a => a,
		gen = function* namedGenerator(a) { yield a; },
		asyncFn = async function namedAsync(a) { return a; },
		asyncGen = async function* namedAsyncGenerator(a) { yield a; },
		methods = {
			async /**/(a) { return a; },
			async asyncMethod(a) { return a; },
			*generatorMethod(a) { yield a; },
			async*asyncGeneratorMethod(a) { yield a; },
			[1 + 2](a) { return a; },
			'🐷'(b) { return b; },
			"🐮"(b) { return b; },
			dd中文(a) { return a; },
			1.2(a) { return a; },
			.5(a) { return a; },
			0x10(a) { return a; }
		};

	const cases = [
		[named, 'function(a){ return a; }', value => assert.strictEqual(value(2), 2)],
		[anon, 'function(a){ return a; }', value => assert.strictEqual(value(2), 2)],
		[arrow, '(async)=>{return async}', value => assert.strictEqual(value(2), 2)],
		[arrowWrapped, '(a)=>{return a + 1}', value => assert.strictEqual(value(2), 3)],
		[arrowObject, '(a)=>{return { value: a }}', value => assert.deepStrictEqual(value(2), { value: 2 })],
		[arrowPartialParens, '(a)=>{return (a) + 1}', value => assert.strictEqual(value(2), 3)],
		[asyncArrow, 'async(a)=>{return a}', async value => assert.strictEqual(await value(2), 2)],
		[gen, 'function*(a){ yield a; }', value => assert.strictEqual(value(2).next().value, 2)],
		[asyncFn, 'async function(a){ return a; }', async value => assert.strictEqual(await value(2), 2)],
		[asyncGen, 'async function*(a){ yield a; }', async value => assert.strictEqual((await value(2).next()).value, 2)],
		[methods.async, 'function(a){ return a; }', value => assert.strictEqual(value(2), 2)],
		[methods.asyncMethod, 'async function(a){ return a; }', async value => assert.strictEqual(await value(2), 2)],
		[methods.generatorMethod, 'function*(a){ yield a; }', value => assert.strictEqual(value(2).next().value, 2)],
		[methods.asyncGeneratorMethod, 'async function*(a){ yield a; }', async value => assert.strictEqual((await value(2).next()).value, 2)],
		[methods[3], 'function(a){ return a; }', value => assert.strictEqual(value(2), 2)],
		[methods['🐷'], 'function(b){ return b; }', value => assert.strictEqual(value(2), 2)],
		[methods['🐮'], 'function(b){ return b; }', value => assert.strictEqual(value(2), 2)],
		[methods.dd中文, 'function(a){ return a; }', value => assert.strictEqual(value(2), 2)],
		[methods[1.2], 'function(a){ return a; }', value => assert.strictEqual(value(2), 2)],
		[methods[0.5], 'function(a){ return a; }', value => assert.strictEqual(value(2), 2)],
		[methods[16], 'function(a){ return a; }', value => assert.strictEqual(value(2), 2)]
	];

	for (const [fn, expected, check] of cases) {
		const source = toJsex(fn);
		await test(`fn: ${expected.slice(0, 40)}`, async () => {
			assert.strictEqual(source, expected);
			const value = parse(source);
			assert.strictEqual(realType(value), realType(fn));
			await check(value);
		});
	}

	await test('accessor property serialization', () => {
		const withAccessor = {};
		Object.defineProperty(withAccessor, 'fromGetter', { get() { return 7; } });
		Object.defineProperty(withAccessor, 'setterOnly', { set(v) { this.value = v; } });
		const accessorValue = parse(toJsex(withAccessor));
		assert.strictEqual(accessorValue.fromGetter, 7);
		assert.strictEqual(accessorValue.setterOnly, undefined);
		assert(!('value' in accessorValue));
	});

	await test('leading comments in parsing', () => {
		let result = '\n/* lead */ // line\n[1,2]'.parseJsex();
		assert(result);
		assert.strictEqual(result.length, '\n/* lead */ // line\n[1,2]'.length);
		assert.deepStrictEqual(result.value, [1, 2]);
	});

	await test('partial parsing (nullx, truex, new Setx)', () => {
		let result = 'nullx'.parseJsex();
		assert(result);
		assert.strictEqual(result.length, 'null'.length);
		assert.strictEqual(result.value, null);
		result = 'truex'.parseJsex();
		assert(result);
		assert.strictEqual(result.length, 'true'.length);
		assert.strictEqual(result.value, true);
		result = 'new Setx'.parseJsex();
		assert(result);
		assert.strictEqual(result.length, 'new Set'.length);
		assert.strictEqual(result.value.size, 0);
	});

	await test('basic parseJsex types', () => {
		assert.strictEqual(parse('new Date(5)').getTime(), 5);
		assert.deepStrictEqual([...parse('new Map([[1,"one"]])')], [[1, 'one']]);
		assert.deepStrictEqual([...parse('new Uint16Array([1,2])')], [1, 2]);
		assert.strictEqual(parse('Symbol.iterator'), Symbol.iterator);
		assert.strictEqual(parse('Error("bad")').message, 'bad');
		assert.strictEqual(parse('SyntaxError("bad")').message, 'bad');
		assert.strictEqual(parse('/a/g').global, true);
		assert.strictEqual(parse('(a)=>{return a}')(3), 3);
	});

	await test('nested complex structure', () => {
		const nested = parse('{"items":[/*a*/new Date(5), new Set([1,"x"]), new Map([[1,"one"]]), Symbol.for("jsex-test"), new Uint8Array([1,2]), TypeError("bad")],"__proto__":null}');
		assert.strictEqual(nested.items[0].getTime(), 5);
		assert.deepStrictEqual([...nested.items[1]], [1, 'x']);
		assert.deepStrictEqual([...nested.items[2]], [[1, 'one']]);
		assert.strictEqual(nested.items[3], Symbol.for('jsex-test'));
		assert.deepStrictEqual([...nested.items[4]], [1, 2]);
		assert.strictEqual(nested.items[5].message, 'bad');
		assert(!('__proto__' in nested));
	});

	section('Original Tests — Security');

	await test('function does not execute trailing code', () => {
		delete globalThis.__jsexInjected;
		const result = 'function(){};globalThis.__jsexInjected=1'.parseJsex();
		assert(result);
		assert.strictEqual(result.length, 'function(){}'.length);
		assert.strictEqual(typeof result.value, 'function');
		assert.strictEqual(globalThis.__jsexInjected, undefined);
	});

	await test('named functions are rejected', () => {
		assert.strictEqual('function named(){}'.parseJsex(), undefined);
		assert.strictEqual('function* named(){}'.parseJsex(), undefined);
		assert.strictEqual('async function named(){}'.parseJsex(), undefined);
	});

	await test('arrow without block body is rejected', () => {
		delete globalThis.__jsexInjected;
		let result = 'a=>a;globalThis.__jsexInjected=1'.parseJsex();
		assert.strictEqual(result, undefined);
		assert.strictEqual(globalThis.__jsexInjected, undefined);
		result = '()=>globalThis.__jsexInjected=1'.parseJsex();
		assert.strictEqual(result, undefined);
		assert.strictEqual(globalThis.__jsexInjected, undefined);
	});

	await test('arrow with block body does not execute trailing code', () => {
		delete globalThis.__jsexInjected;
		const result = '()=>{globalThis.__jsexInjected=1};globalThis.__jsexInjected=2'.parseJsex();
		assert(result);
		assert.strictEqual(result.length, '()=>{globalThis.__jsexInjected=1}'.length);
		assert.strictEqual(globalThis.__jsexInjected, undefined);
		result.value();
		assert.strictEqual(globalThis.__jsexInjected, 1);
		delete globalThis.__jsexInjected;
	});

	await test('Function constructor injection is blocked', () => {
		assert.strictEqual('Function("globalThis.__jsexInjected=1")'.parseJsex(), undefined);
		assert.strictEqual('(async()=>{}).constructor("globalThis.__jsexInjected=1")'.parseJsex(), undefined);
		const result = 'function*(){}.constructor("a","yield a")'.parseJsex();
		assert(result);
		assert.strictEqual(result.length, 'function*(){}'.length);
	});

	await test('roundtrip complex array', () => {
		const source = toJsex([
			1, -0, 2n, Symbol.for('jsex-test'), new Date(5), /a[,}]b/gi,
			new Set([1, 'x']), new Map([[1, 'one']]),
			new Uint8Array([1, 2]), new Float32Array([1.5, 2.5])
		]);
		const value = parse(source);
		assert.strictEqual(value[0], 1);
		assert(Object.is(value[1], -0));
		assert.strictEqual(value[2], 2n);
		assert.strictEqual(value[3], Symbol.for('jsex-test'));
		assert.strictEqual(value[4].getTime(), 5);
		assert.strictEqual(value[5].source, 'a[,}]b');
		assert.deepStrictEqual([...value[6]], [1, 'x']);
		assert.deepStrictEqual([...value[7]], [[1, 'one']]);
		assert.deepStrictEqual([...value[8]], [1, 2]);
		assert.deepStrictEqual([...value[9]], [1.5, 2.5]);
	});

	// ═══════════════════════════════════════════════════════
	// EDGE CASE TESTS
	// ═══════════════════════════════════════════════════════

	// ─── Primitives ───────────────────────────────────────
	section('Primitives');

	await test('null', () => {
		assert.strictEqual(toJsex(null), 'null');
		assert.strictEqual(parse('null'), null);
	});

	await test('undefined', () => {
		assert.strictEqual(toJsex(undefined), 'undefined');
		assert.strictEqual(parse('undefined'), undefined);
	});

	await test('boolean true/false', () => {
		assert.strictEqual(toJsex(true), 'true');
		assert.strictEqual(toJsex(false), 'false');
		assert.strictEqual(parse('true'), true);
		assert.strictEqual(parse('false'), false);
	});

	await test('NaN', () => {
		assert.strictEqual(toJsex(NaN), 'NaN');
		assert(Number.isNaN(parse('NaN')));
	});

	// ─── Numbers: edge cases ──────────────────────────────
	section('Numbers — Edge Cases');

	await test('positive zero', () => {
		assert.strictEqual(toJsex(0), '0');
		assert(Object.is(parse('0'), 0));
	});

	await test('negative zero', () => {
		assert.strictEqual(toJsex(-0), '-0');
		assert(Object.is(parse('-0'), -0));
	});

	await test('Infinity', () => {
		assert.strictEqual(toJsex(Infinity), 'Infinity');
		assert.strictEqual(parse('Infinity'), Infinity);
	});

	await test('negative Infinity', () => {
		assert.strictEqual(toJsex(-Infinity), '-Infinity');
		assert.strictEqual(parse('-Infinity'), -Infinity);
	});

	await test('MAX_SAFE_INTEGER', () => {
		const v = Number.MAX_SAFE_INTEGER;
		assert.strictEqual(roundtrip(v), v);
	});

	await test('MIN_SAFE_INTEGER', () => {
		const v = Number.MIN_SAFE_INTEGER;
		assert.strictEqual(roundtrip(v), v);
	});

	await test('very small float', () => {
		const v = 5e-324; // Number.MIN_VALUE
		assert.strictEqual(roundtrip(v), v);
	});

	await test('very large float', () => {
		const v = 1.7976931348623157e+308; // Number.MAX_VALUE
		assert.strictEqual(roundtrip(v), v);
	});

	await test('scientific notation', () => {
		const v = 1.5e10;
		assert.strictEqual(roundtrip(v), v);
	});

	await test('hex number 0xFF', () => {
		assert.strictEqual(parse('0xFF'), 255);
	});

	await test('octal number 0o77', () => {
		assert.strictEqual(parse('0o77'), 63);
	});

	await test('binary number 0b1010', () => {
		assert.strictEqual(parse('0b1010'), 10);
	});

	// ─── BigInt edge cases ────────────────────────────────
	section('BigInt — Edge Cases');

	await test('bigint zero', () => {
		assert.strictEqual(toJsex(0n), '0n');
		assert.strictEqual(parse('0n'), 0n);
	});

	await test('negative bigint', () => {
		assert.strictEqual(toJsex(-42n), '-42n');
		assert.strictEqual(parse('-42n'), -42n);
	});

	await test('very large bigint', () => {
		const v = 99999999999999999999999999999999999999n;
		assert.strictEqual(roundtrip(v), v);
	});

	await test('bigint hex notation', () => {
		assert.strictEqual(parse('0xFFn'), 255n);
	});

	await test('bigint binary notation', () => {
		assert.strictEqual(parse('0b1010n'), 10n);
	});

	await test('bigint octal notation', () => {
		assert.strictEqual(parse('0o77n'), 63n);
	});

	// ─── Strings edge cases ───────────────────────────────
	section('Strings — Edge Cases');

	await test('empty string', () => {
		assert.strictEqual(toJsex(''), '""');
		assert.strictEqual(parse('""'), '');
	});

	await test('string with newlines', () => {
		const v = 'hello\nworld\r\n!';
		const s = toJsex(v);
		assert(s.includes('\\n'));
		assert(s.includes('\\r'));
		assert.strictEqual(roundtrip(v), v);
	});

	await test('string with quotes', () => {
		const v = 'say "hello"';
		assert.strictEqual(roundtrip(v), v);
	});

	await test('string with backslashes', () => {
		const v = 'C:\\Users\\test';
		assert.strictEqual(roundtrip(v), v);
	});

	await test('string with Unicode surrogate pairs (emoji)', () => {
		const v = '😀🎉🚀';
		assert.strictEqual(roundtrip(v), v);
	});

	await test('string with lone surrogates', () => {
		const v = '\uD800';
		const s = toJsex(v);
		assert(s.includes('\\ud800'));
		assert.strictEqual(roundtrip(v), v);
	});

	await test('string with null character', () => {
		const v = 'a\0b';
		assert.strictEqual(roundtrip(v), v);
	});

	await test('string with various escape sequences parsed', () => {
		assert.strictEqual(parse('"\\t"'), '\t');
		assert.strictEqual(parse('"\\b"'), '\b');
		assert.strictEqual(parse('"\\f"'), '\f');
		assert.strictEqual(parse('"\\v"'), '\v');
		assert.strictEqual(parse('"\\n"'), '\n');
		assert.strictEqual(parse('"\\r"'), '\r');
		assert.strictEqual(parse('"\\\\"'), '\\');
		assert.strictEqual(parse('"\\""'), '"');
	});

	await test('string with hex escape \\xNN', () => {
		assert.strictEqual(parse('"\\x41"'), 'A');
	});

	await test('string with unicode escape \\uNNNN', () => {
		assert.strictEqual(parse('"\\u0041"'), 'A');
	});

	await test('string with unicode brace escape \\u{NNNN}', () => {
		assert.strictEqual(parse('"\\u{41}"'), 'A');
		assert.strictEqual(parse('"\\u{1F600}"'), '😀');
	});

	await test('string with octal escape', () => {
		assert.strictEqual(parse('"\\101"'), 'A');
	});

	await test('string "__proto__" key', () => {
		const v = '__proto__';
		assert.strictEqual(roundtrip(v), v);
	});

	// ─── Symbols ──────────────────────────────────────────
	section('Symbols');

	await test('Symbol() with no description', () => {
		const s = toJsex(Symbol());
		assert.strictEqual(s, 'Symbol()');
	});

	await test('Symbol with description', () => {
		const s = toJsex(Symbol('myDesc'));
		assert.strictEqual(s, 'Symbol("myDesc")');
	});

	await test('Symbol.for roundtrip', () => {
		const sym = Symbol.for('test-key');
		const s = toJsex(sym);
		assert.strictEqual(s, 'Symbol.for("test-key")');
		assert.strictEqual(parse(s), sym);
	});

	await test('well-known symbols', () => {
		assert.strictEqual(toJsex(Symbol.iterator), 'Symbol.iterator');
		assert.strictEqual(parse('Symbol.iterator'), Symbol.iterator);
		assert.strictEqual(toJsex(Symbol.hasInstance), 'Symbol.hasInstance');
		assert.strictEqual(parse('Symbol.hasInstance'), Symbol.hasInstance);
		assert.strictEqual(toJsex(Symbol.toPrimitive), 'Symbol.toPrimitive');
		assert.strictEqual(parse('Symbol.toPrimitive'), Symbol.toPrimitive);
	});

	await test('Symbol.for with special chars in key', () => {
		const sym = Symbol.for('key with "quotes" and \\backslash');
		const s = toJsex(sym);
		assert.strictEqual(parse(s), sym);
	});

	await test('Symbol.for with empty string key', () => {
		const sym = Symbol.for('');
		const s = toJsex(sym);
		assert.strictEqual(s, 'Symbol.for("")');
		assert.strictEqual(parse(s), sym);
	});

	// ─── Date ─────────────────────────────────────────────
	section('Date');

	await test('Date epoch 0', () => {
		const d = new Date(0);
		assert.strictEqual(toJsex(d), 'new Date(0)');
		assert.strictEqual(roundtrip(d).getTime(), 0);
	});

	await test('Date negative timestamp', () => {
		const d = new Date(-1000);
		assert.strictEqual(toJsex(d), 'new Date(-1000)');
		assert.strictEqual(roundtrip(d).getTime(), -1000);
	});

	await test('Date invalid (NaN)', () => {
		const d = new Date(NaN);
		const s = toJsex(d);
		assert.strictEqual(s, 'new Date(NaN)');
		assert(Number.isNaN(parse(s).getTime()));
	});

	await test('Date very large timestamp', () => {
		const d = new Date(8640000000000000); // max valid Date
		assert.strictEqual(roundtrip(d).getTime(), 8640000000000000);
	});

	// ─── RegExp ───────────────────────────────────────────
	section('RegExp');

	await test('simple regex', () => {
		const r = /abc/;
		assert.strictEqual(toJsex(r), '/abc/');
		assert.strictEqual(parse('/abc/').source, 'abc');
	});

	await test('regex with all flags', () => {
		const r = /abc/gimsuy;
		const s = toJsex(r);
		const parsed = parse(s);
		assert.strictEqual(parsed.source, 'abc');
		assert(parsed.global && parsed.ignoreCase && parsed.multiline && parsed.sticky && parsed.unicode && parsed.dotAll);
	});

	await test('regex with special chars', () => {
		const r = /a\.b\+c\*d\?/;
		assert.strictEqual(roundtrip(r).source, r.source);
	});

	await test('regex with character class', () => {
		const r = /[a-z0-9_$]/;
		assert.strictEqual(roundtrip(r).source, r.source);
	});

	await test('regex with groups', () => {
		const r = /(a)(b)(c)/;
		assert.strictEqual(roundtrip(r).source, r.source);
	});

	await test('regex with escaped forward slash', () => {
		const r = /a\/b/;
		assert.strictEqual(roundtrip(r).source, r.source);
	});

	await test('regex with lone surrogate', () => {
		const r = RegExp('\uD800');
		const s = toJsex(r);
		assert(s.includes('\\ud800'));
	});

	// ─── Error ────────────────────────────────────────────
	section('Error');

	await test('Error with empty message', () => {
		const e = Error();
		const s = toJsex(e);
		assert.strictEqual(s, 'Error()');
		assert.strictEqual(parse(s).message, '');
	});

	await test('Error with message', () => {
		const e = Error('oops');
		const s = toJsex(e);
		assert.strictEqual(s, 'Error("oops")');
		assert.strictEqual(parse(s).message, 'oops');
	});

	await test('TypeError', () => {
		const e = TypeError('type error');
		assert.strictEqual(parse(toJsex(e)).message, 'type error');
		assert(parse(toJsex(e)) instanceof TypeError);
	});

	await test('RangeError', () => {
		const e = RangeError('range error');
		assert.strictEqual(parse(toJsex(e)).message, 'range error');
		assert(parse(toJsex(e)) instanceof RangeError);
	});

	await test('SyntaxError', () => {
		const e = SyntaxError('syntax error');
		assert.strictEqual(parse(toJsex(e)).message, 'syntax error');
		assert(parse(toJsex(e)) instanceof SyntaxError);
	});

	await test('ReferenceError', () => {
		const e = ReferenceError('ref error');
		assert.strictEqual(parse(toJsex(e)).message, 'ref error');
		assert(parse(toJsex(e)) instanceof ReferenceError);
	});

	await test('EvalError', () => {
		const e = EvalError('eval error');
		assert.strictEqual(parse(toJsex(e)).message, 'eval error');
		assert(parse(toJsex(e)) instanceof EvalError);
	});

	await test('URIError', () => {
		const e = URIError('uri error');
		assert.strictEqual(parse(toJsex(e)).message, 'uri error');
		assert(parse(toJsex(e)) instanceof URIError);
	});

	await test('Error with special chars in message', () => {
		const e = Error('line1\nline2\r"quoted"');
		const parsed = roundtrip(e);
		assert.strictEqual(parsed.message, 'line1\nline2\r"quoted"');
	});

	await test('AggregateError without message', () => {
		const e = AggregateError([Error('a'), Error('b')]);
		const s = toJsex(e);
		const parsed = parse(s);
		assert.strictEqual(parsed.name, 'AggregateError');
		assert.strictEqual(parsed.errors.length, 2);
		assert.strictEqual(parsed.errors[0].message, 'a');
		assert.strictEqual(parsed.errors[1].message, 'b');
	});

	await test('AggregateError with message', () => {
		const e = AggregateError([Error('a')], 'aggregate msg');
		const s = toJsex(e);
		const parsed = parse(s);
		assert.strictEqual(parsed.message, 'aggregate msg');
		assert.strictEqual(parsed.errors[0].message, 'a');
	});

	// ─── Set ──────────────────────────────────────────────
	section('Set');

	await test('empty Set', () => {
		const s = toJsex(new Set());
		assert.strictEqual(s, 'new Set');
		const parsed = parse(s);
		assert(parsed instanceof Set);
		assert.strictEqual(parsed.size, 0);
	});

	await test('Set with mixed types', () => {
		const v = new Set([1, 'two', true, null, undefined]);
		const parsed = roundtrip(v);
		assert(parsed instanceof Set);
		assert(parsed.has(1));
		assert(parsed.has('two'));
		assert(parsed.has(true));
		assert(parsed.has(null));
		assert(parsed.has(undefined));
	});

	await test('Set with nested structure', () => {
		const v = new Set([new Set([1, 2]), new Map([[1, 2]])]);
		const parsed = roundtrip(v);
		assert.strictEqual(parsed.size, 2);
	});

	await test('empty Set parsed (no parens)', () => {
		const result = 'new Set'.parseJsex();
		assert(result);
		assert.strictEqual(result.length, 'new Set'.length);
		assert(result.value instanceof Set);
		assert.strictEqual(result.value.size, 0);
	});

	// ─── Map ──────────────────────────────────────────────
	section('Map');

	await test('empty Map', () => {
		const s = toJsex(new Map());
		assert.strictEqual(s, 'new Map');
		const parsed = parse(s);
		assert(parsed instanceof Map);
		assert.strictEqual(parsed.size, 0);
	});

	await test('Map with various key types', () => {
		const v = new Map([[1, 'one'], ['two', 2], [true, 'yes']]);
		const parsed = roundtrip(v);
		assert.strictEqual(parsed.get(1), 'one');
		assert.strictEqual(parsed.get('two'), 2);
		assert.strictEqual(parsed.get(true), 'yes');
	});

	await test('Map with object values', () => {
		const v = new Map([['key', { nested: true }]]);
		const parsed = roundtrip(v);
		assert.strictEqual(parsed.get('key').nested, true);
	});

	await test('empty Map parsed (no parens)', () => {
		const result = 'new Map'.parseJsex();
		assert(result);
		assert.strictEqual(result.length, 'new Map'.length);
		assert(result.value instanceof Map);
		assert.strictEqual(result.value.size, 0);
	});

	// ─── TypedArrays ──────────────────────────────────────
	section('TypedArrays');

	const typedArrayTypes = [
		['Int8Array', Int8Array, [1, -128, 127]],
		['Uint8Array', Uint8Array, [0, 128, 255]],
		['Uint8ClampedArray', Uint8ClampedArray, [0, 128, 255]],
		['Int16Array', Int16Array, [1, -32768, 32767]],
		['Uint16Array', Uint16Array, [0, 32768, 65535]],
		['Int32Array', Int32Array, [1, -2147483648, 2147483647]],
		['Uint32Array', Uint32Array, [0, 2147483648, 4294967295]],
		['Float32Array', Float32Array, [1.5, -3.14, 0]],
		['Float64Array', Float64Array, [1.5, -3.14, 0, Number.MAX_SAFE_INTEGER]],
		['BigInt64Array', BigInt64Array, [0n, -1n, 9223372036854775807n]],
		['BigUint64Array', BigUint64Array, [0n, 1n, 18446744073709551615n]],
	];

	for (const [name, Ctor, values] of typedArrayTypes) {
		await test(`${name} roundtrip`, () => {
			const arr = new Ctor(values);
			const s = toJsex(arr);
			assert(s.startsWith(`new ${name}(`));
			const parsed = parse(s);
			assert(parsed instanceof Ctor);
			assert.strictEqual(parsed.length, arr.length);
			for (let i = 0; i < arr.length; i++) {
				assert.strictEqual(parsed[i], arr[i]);
			}
		});
	}

	await test('empty TypedArray', () => {
		const arr = new Uint8Array([]);
		const s = toJsex(arr);
		const parsed = parse(s);
		assert(parsed instanceof Uint8Array);
		assert.strictEqual(parsed.length, 0);
	});

	// ─── Arrays ───────────────────────────────────────────
	section('Arrays');

	await test('empty array', () => {
		assert.strictEqual(toJsex([]), '[]');
		assert.deepStrictEqual(parse('[]'), []);
	});

	await test('array with single element', () => {
		assert.deepStrictEqual(roundtrip([1]), [1]);
	});

	await test('nested arrays', () => {
		const v = [[1, [2, [3]]]];
		assert.deepStrictEqual(roundtrip(v), v);
	});

	await test('array with mixed types', () => {
		const s = toJsex([1, 'two', true, null, undefined, -0, NaN, Infinity]);
		const parsed = parse(s);
		assert.strictEqual(parsed[0], 1);
		assert.strictEqual(parsed[1], 'two');
		assert.strictEqual(parsed[2], true);
		assert.strictEqual(parsed[3], null);
		assert.strictEqual(parsed[4], undefined);
		assert(Object.is(parsed[5], -0));
		assert(Number.isNaN(parsed[6]));
		assert.strictEqual(parsed[7], Infinity);
	});

	await test('array with trailing comma in parse', () => {
		// trailing comma after last element should fail to parse the closing bracket at ']'
		// because after reading the element and seeing ',', it expects another element
		const result = '[1,2,]'.parseJsex();
		assert.strictEqual(result, undefined);
	});

	// ─── Objects ──────────────────────────────────────────
	section('Objects');

	await test('empty object', () => {
		const s = toJsex({});
		assert.strictEqual(s, '{"__proto__":null}');
		const parsed = parse(s);
		assert.strictEqual(Object.getPrototypeOf(parsed), null);
		assert.strictEqual(Object.keys(parsed).length, 0);
	});

	await test('object with __proto__: null', () => {
		const parsed = parse('{"__proto__":null}');
		assert.strictEqual(Object.getPrototypeOf(parsed), null);
	});

	await test('object __proto__ key is dropped during parsing', () => {
		const parsed = parse('{"__proto__":"should be dropped","key":"value","__proto__":null}');
		// __proto__ with value "should be dropped" should be ignored (key === "__proto__" => null key)
		assert(!('__proto__' in parsed));
		assert.strictEqual(parsed.key, 'value');
	});

	await test('object with ["__proto__"] key (escaped form)', () => {
		const obj = { __proto__: null };
		Object.defineProperty(obj, '__proto__', {
			value: 'test',
			writable: true,
			enumerable: true,
			configurable: true
		});
		const s = toJsex(obj);
		assert(s.includes('["__proto__"]'));
	});

	await test('object with symbol keys', () => {
		const sym = Symbol.for('testKey');
		const obj = { __proto__: null, [sym]: 42 };
		const s = toJsex(obj);
		const parsed = parse(s);
		assert.strictEqual(parsed[sym], 42);
	});

	await test('object with non-enumerable properties', () => {
		const obj = {};
		Object.defineProperty(obj, 'hidden', { value: 'secret', enumerable: false });
		const s = toJsex(obj);
		assert(s.includes('hidden'));
		const parsed = parse(s);
		assert.strictEqual(parsed.hidden, 'secret');
	});

	await test('deeply nested object', () => {
		const obj = { a: { b: { c: { d: { e: 'deep' } } } } };
		const parsed = roundtrip(obj);
		assert.strictEqual(parsed.a.b.c.d.e, 'deep');
	});

	await test('object with various key names', () => {
		const obj = { '': 'empty', ' ': 'space', '123': 'numeric', 'a-b': 'hyphen' };
		const parsed = roundtrip(obj);
		assert.strictEqual(parsed[''], 'empty');
		assert.strictEqual(parsed[' '], 'space');
		assert.strictEqual(parsed['123'], 'numeric');
		assert.strictEqual(parsed['a-b'], 'hyphen');
	});

	// ─── Circular structure ───────────────────────────────
	section('Circular Structure');

	await test('circular reference returns undefined (default)', () => {
		const obj = {};
		obj.self = obj;
		// Circular value serializes as undefined (omitted), but key "self" is
		// still present. The undefined value from realToJsex means the property
		// is skipped entirely.
		const s = toJsex(obj);
		// The self property should be skipped since its value is undefined (circular)
		assert(!s.includes('"self"'));
		assert(s.includes('"__proto__":null'));
	});

	await test('circular reference throws in debug mode', () => {
		const obj = {};
		obj.self = obj;
		assert.throws(() => toJsex(obj, { debug: true }), TypeError);
	});

	await test('circular reference in array', () => {
		const arr = [1, 2];
		arr.push(arr);
		// Should not throw by default
		const s = toJsex(arr);
		assert.strictEqual(typeof s, 'string');
	});

	// ─── Debug mode ───────────────────────────────────────
	section('Debug Mode');

	await test('native function throws in debug mode', () => {
		assert.throws(() => toJsex(console.log, { debug: true }), TypeError);
	});

	await test('native function returns undefined in non-debug mode', () => {
		assert.strictEqual(toJsex(console.log), undefined);
	});

	await test('class throws in debug mode (no implicitConversion)', () => {
		class Foo { }
		assert.throws(() => toJsex(Foo, { debug: true }), TypeError);
	});

	await test('class returns undefined by default', () => {
		class Foo { }
		assert.strictEqual(toJsex(Foo), undefined);
	});

	// ─── implicitConversion ───────────────────────────────
	section('implicitConversion');

	await test('class serialized as string with implicitConversion', () => {
		class Foo { constructor() { } }
		const s = toJsex(Foo, { implicitConversion: true });
		assert(typeof s === 'string');
		assert(s.startsWith('"'));
	});

	await test('custom valueOf object with implicitConversion', () => {
		const obj = { valueOf() { return 42; } };
		const s = toJsex(obj, { implicitConversion: true });
		assert.strictEqual(s, '42');
	});

	await test('without implicitConversion, custom valueOf is not used', () => {
		const obj = { valueOf() { return 42; } };
		const s = toJsex(obj);
		// Should serialize as object with valueOf property, not as 42
		assert(s.includes('valueOf'));
	});

	// ─── Sorting ──────────────────────────────────────────
	section('Sorting');

	await test('sorted object keys', () => {
		const obj = { c: 3, a: 1, b: 2 };
		const s = toJsex(obj, { sorting: true });
		const aPos = s.indexOf('"a"');
		const bPos = s.indexOf('"b"');
		const cPos = s.indexOf('"c"');
		assert(aPos < bPos && bPos < cPos);
	});

	await test('sorted Set elements', () => {
		const set = new Set([3, 1, 2]);
		const s = toJsex(set, { sorting: true });
		const p1 = s.indexOf('1');
		const p2 = s.indexOf('2');
		const p3 = s.indexOf('3');
		assert(p1 < p2 && p2 < p3);
	});

	await test('sorted Map entries', () => {
		const map = new Map([['c', 3], ['a', 1], ['b', 2]]);
		const s = toJsex(map, { sorting: true });
		const aPos = s.indexOf('"a"');
		const bPos = s.indexOf('"b"');
		const cPos = s.indexOf('"c"');
		assert(aPos < bPos && bPos < cPos);
	});

	// ─── JSON compatibility ───────────────────────────────
	section('JSON Compatibility');

	await test('jsonCompatible generates valid JSON for simple data', () => {
		const data = { name: 'test', value: 42, flag: true, nothing: null };
		const s = toJsex(data, { jsonCompatible: true });
		const parsed = JSON.parse(s);
		assert.strictEqual(parsed.name, 'test');
		assert.strictEqual(parsed.value, 42);
		assert.strictEqual(parsed.flag, true);
		assert.strictEqual(parsed.nothing, null);
	});

	await test('jsonCompatible omits __proto__:null', () => {
		const data = { key: 'value' };
		const s = toJsex(data, { jsonCompatible: true });
		assert(!s.includes('__proto__'));
	});

	await test('jsonCompatible escapes control characters', () => {
		const data = 'tab\there\bnull\0';
		const s = toJsex(data, { jsonCompatible: true });
		assert(!s.includes('\t'));
		assert(!s.includes('\b'));
		assert(s.includes('\\t'));
		assert(s.includes('\\b'));
	});

	await test('jsonCompatible: undefined in array stays undefined (not valid JSON)', () => {
		// jsonCompatible only replaces truly unserializable values (realToJsex returns
		// js-undefined) with null. The js value `undefined` serializes to the string
		// literal "undefined", so it is NOT replaced. This is documented: jsonCompatible
		// only works when data doesn't contain extended types.
		const data = [1, undefined, 3];
		const s = toJsex(data, { jsonCompatible: true });
		assert.strictEqual(s, '[1,undefined,3]');
	});

	await test('jsonCompatible: native function in array becomes null', () => {
		// This IS the real use case for jsonCompatible null substitution:
		// native functions can't be serialized, so they get replaced with null
		const data = [1, console.log, 3];
		const s = toJsex(data, { jsonCompatible: true });
		assert.strictEqual(s, '[1,null,3]');
		const parsed = JSON.parse(s);
		assert.strictEqual(parsed[0], 1);
		assert.strictEqual(parsed[1], null);
		assert.strictEqual(parsed[2], 3);
	});

	await test('jsonCompatible nested objects', () => {
		const data = { a: { b: { c: 1 } } };
		const s = toJsex(data, { jsonCompatible: true });
		const parsed = JSON.parse(s);
		assert.strictEqual(parsed.a.b.c, 1);
	});

	// ─── Functions edge cases ─────────────────────────────
	section('Functions — Edge Cases');

	await test('function with no params', () => {
		const fn = function () { return 42; };
		const s = toJsex(fn);
		assert.strictEqual(parse(s)(), 42);
	});

	await test('arrow function with multiple params', () => {
		const fn = (a, b, c) => { return a + b + c; };
		const s = toJsex(fn);
		assert.strictEqual(parse(s)(1, 2, 3), 6);
	});

	await test('arrow function returning string', () => {
		const fn = () => { return 'hello'; };
		const s = toJsex(fn);
		assert.strictEqual(parse(s)(), 'hello');
	});

	await test('function with complex body', () => {
		const fn = function (x) { if (x > 0) { return x * 2; } else { return -x; } };
		const s = toJsex(fn);
		const parsed = parse(s);
		assert.strictEqual(parsed(5), 10);
		assert.strictEqual(parsed(-3), 3);
	});

	await test('getter/setter functions are serialized correctly', () => {
		const obj = {
			get value() { return 42; },
			set value(v) { this._v = v; }
		};
		const getterFn = Object.getOwnPropertyDescriptor(obj, 'value').get;
		const s = toJsex(getterFn);
		assert.strictEqual(parse(s)(), 42);
	});

	// ─── Parse failures (invalid input) ───────────────────
	section('Parse Failures — Invalid Input');

	await test('empty string parse returns undefined', () => {
		assert.strictEqual(''.parseJsex(), undefined);
	});

	await test('random text parse returns undefined', () => {
		assert.strictEqual('hello world'.parseJsex(), undefined);
	});

	await test('unclosed string', () => {
		assert.strictEqual('"unclosed'.parseJsex(), undefined);
	});

	await test('unclosed array', () => {
		assert.strictEqual('[1,2'.parseJsex(), undefined);
	});

	await test('unclosed object', () => {
		assert.strictEqual('{"a":1'.parseJsex(), undefined);
	});

	await test('invalid number format', () => {
		assert.strictEqual('--5'.parseJsex(), undefined);
	});

	await test('invalid regex', () => {
		assert.strictEqual('/[invalid'.parseJsex(), undefined);
	});

	await test('new Date() with no argument', () => {
		assert.strictEqual('new Date()'.parseJsex(), undefined);
	});

	await test('new Date("string") is rejected', () => {
		assert.strictEqual('new Date("2021-01-01")'.parseJsex(), undefined);
	});

	await test('new Map with invalid entries', () => {
		// entries must be [key, value] pairs
		assert.strictEqual('new Map([1,2,3])'.parseJsex(), undefined);
	});

	await test('new Set with non-array argument', () => {
		assert.strictEqual('new Set(1)'.parseJsex(), undefined);
	});

	// ─── Security: injection prevention ───────────────────
	section('Security — Injection Prevention');

	await test('IIFE injection blocked', () => {
		delete globalThis.__jsexInjected;
		const result = '(function(){globalThis.__jsexInjected=1})()'.parseJsex();
		// this should either fail or not execute the inner code
		assert.strictEqual(globalThis.__jsexInjected, undefined);
		delete globalThis.__jsexInjected;
	});

	await test('eval injection blocked', () => {
		delete globalThis.__jsexInjected;
		const result = 'eval("globalThis.__jsexInjected=1")'.parseJsex();
		assert.strictEqual(globalThis.__jsexInjected, undefined);
		delete globalThis.__jsexInjected;
	});

	await test('constructor injection via prototype', () => {
		delete globalThis.__jsexInjected;
		const result = '({}).constructor.constructor("globalThis.__jsexInjected=1")()'.parseJsex();
		assert.strictEqual(globalThis.__jsexInjected, undefined);
		delete globalThis.__jsexInjected;
	});

	await test('forbiddenMethods blocks toString', () => {
		const obj = '{"toString":(a)=>{return a},"__proto__":null}'.parseJsex();
		assert(obj);
		// toString should be blocked by default implicit methods
		assert.strictEqual(obj.value.toString, undefined);
	});

	await test('forbiddenMethods blocks valueOf', () => {
		const obj = '{"valueOf":(a)=>{return a},"__proto__":null}'.parseJsex();
		assert(obj);
		assert.strictEqual(obj.value.valueOf, undefined);
	});

	await test('forbiddenMethods blocks toJSON', () => {
		const obj = '{"toJSON":(a)=>{return a},"__proto__":null}'.parseJsex();
		assert(obj);
		assert.strictEqual(obj.value.toJSON, undefined);
	});

	await test('forbiddenMethods blocks then (thenable)', () => {
		const obj = '{"then":(a)=>{return a},"__proto__":null}'.parseJsex();
		assert(obj);
		assert.strictEqual(obj.value.then, undefined);
	});

	await test('forbiddenMethods=null allows all methods', () => {
		const obj = '{"toString":(a)=>{return a},"__proto__":null}'.parseJsex(null);
		assert(obj);
		assert.strictEqual(typeof obj.value.toString, 'function');
	});

	await test('custom forbiddenMethods set', () => {
		const custom = new Set(['myMethod']);
		const obj = '{"myMethod":(a)=>{return a},"other":(b)=>{return b},"__proto__":null}'.parseJsex(custom);
		assert(obj);
		assert.strictEqual(obj.value.myMethod, undefined);
		assert.strictEqual(typeof obj.value.other, 'function');
	});

	// ─── Comments in parse ────────────────────────────────
	section('Comments in Parse');

	await test('line comment before value', () => {
		const result = '// comment\n42'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 42);
	});

	await test('block comment before value', () => {
		const result = '/* block */42'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 42);
	});

	await test('whitespace and comments', () => {
		const result = '  \t\n  /* c */ // l\n  "hello"  '.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 'hello');
	});

	await test('comments within array elements', () => {
		const result = '[1,/* inline */2, //line\n3]'.parseJsex();
		assert(result);
		assert.deepStrictEqual(result.value, [1, 2, 3]);
	});

	await test('comments within object', () => {
		const result = '{/* key */"a": /* val */ 1,"__proto__":null}'.parseJsex();
		assert(result);
		assert.strictEqual(result.value.a, 1);
	});

	// ─── Partial parsing (value + trailing data) ──────────
	section('Partial Parsing');

	await test('number followed by extra text', () => {
		const result = '42 extra'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 42);
		assert.strictEqual(result.length, 2); // just '42'
	});

	await test('string followed by extra text', () => {
		const result = '"hello" world'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 'hello');
		assert.strictEqual(result.length, 7);
	});

	await test('array followed by extra text', () => {
		const result = '[1,2] extra'.parseJsex();
		assert(result);
		assert.deepStrictEqual(result.value, [1, 2]);
		assert.strictEqual(result.length, 5);
	});

	await test('false followed by text', () => {
		const result = 'falsex'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, false);
		assert.strictEqual(result.length, 5);
	});

	await test('undefined followed by text', () => {
		const result = 'undefinedx'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, undefined);
		assert.strictEqual(result.length, 9);
	});

	await test('NaN followed by text', () => {
		const result = 'NaNx'.parseJsex();
		assert(result);
		assert(Number.isNaN(result.value));
		assert.strictEqual(result.length, 3);
	});

	// ─── Whitespace handling ──────────────────────────────
	section('Whitespace Handling');

	await test('leading whitespace in parse', () => {
		const result = '   42'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 42);
		assert.strictEqual(result.length, 5);
	});

	await test('whitespace inside object', () => {
		const result = '{  "a"  :  1  ,  "__proto__"  :  null  }'.parseJsex();
		assert(result);
		assert.strictEqual(result.value.a, 1);
	});

	await test('whitespace inside array', () => {
		const result = '[  1  ,  2  ,  3  ]'.parseJsex();
		assert(result);
		assert.deepStrictEqual(result.value, [1, 2, 3]);
	});

	// ─── Special serialization behaviors ──────────────────
	section('Special Serialization Behaviors');

	await test('unsupported types are skipped in object', () => {
		const obj = { a: 1, b: console.log, c: 3 };
		const s = toJsex(obj);
		assert(s.includes('"a":1'));
		assert(s.includes('"c":3'));
		assert(!s.includes('"b"'));
	});

	await test('unsupported types in array serialize as undefined element', () => {
		const arr = [1, console.log, 3];
		const s = toJsex(arr);
		// native function serializes as undefined (missing), so the array should have ,,
		assert(s.includes(','));
	});

	await test('property with undefined value is serialized (unlike JSON)', () => {
		// jsex supports undefined as a first-class type, so it IS serialized
		const obj = { a: 1, b: undefined, c: 3 };
		const s = toJsex(obj);
		assert(s.includes('"b":undefined'));
		const parsed = parse(s);
		assert.strictEqual(parsed.b, undefined);
		assert('b' in parsed);
	});

	await test('nested objects/arrays properly released from circular check', () => {
		// Same object used twice (not circular, just shared reference)
		// The circular detection uses add/delete on a Set, so the same object
		// should be serializable when used in different positions
		const shared = { value: 42 };
		const obj = { a: shared, b: shared };
		const s = toJsex(obj);
		const parsed = parse(s);
		assert.strictEqual(parsed.a.value, 42);
		assert.strictEqual(parsed.b.value, 42);
	});

	// ─── Edge: object parsed as JSON ──────────────────────
	section('JSON Parsing via parseJsex');

	await test('standard JSON parsed by parseJsex', () => {
		const json = '{"name":"test","value":42,"flag":true,"nothing":null}';
		const result = json.parseJsex();
		assert(result);
		assert.strictEqual(result.value.name, 'test');
		assert.strictEqual(result.value.value, 42);
		assert.strictEqual(result.value.flag, true);
		assert.strictEqual(result.value.nothing, null);
	});

	await test('JSON array parsed by parseJsex', () => {
		const json = '[1,2,3,"four",true,null]';
		const result = json.parseJsex();
		assert(result);
		assert.deepStrictEqual(result.value, [1, 2, 3, 'four', true, null]);
	});

	await test('JSON with nested structures', () => {
		const json = '{"a":{"b":[1,2,{"c":3}]}}';
		const result = json.parseJsex();
		assert(result);
		assert.strictEqual(result.value.a.b[2].c, 3);
	});

	// ─── Regex in parse ───────────────────────────────────
	section('RegExp Parsing Edge Cases');

	await test('regex with backslash', () => {
		const parsed = parse('/a\\\\b/');
		assert.strictEqual(parsed.source, 'a\\\\b');
	});

	await test('regex with nested brackets', () => {
		const parsed = parse('/[a[b]c]/');
		// This tests character class parsing
		assert(parsed instanceof RegExp);
	});

	await test('regex empty flags', () => {
		const parsed = parse('/test/');
		assert.strictEqual(parsed.flags, '');
	});

	// ─── Miscellaneous edge cases ─────────────────────────
	section('Miscellaneous');

	await test('serializing and parsing Date(NaN)', () => {
		const d = new Date('invalid');
		const s = toJsex(d);
		assert.strictEqual(s, 'new Date(NaN)');
		const parsed = parse(s);
		assert(Number.isNaN(parsed.getTime()));
	});

	await test('object with only __proto__:null', () => {
		const parsed = parse('{"__proto__":null}');
		assert.strictEqual(Object.getPrototypeOf(parsed), null);
		assert.strictEqual(Object.keys(parsed).length, 0);
	});

	await test('symbol key in object with symbol value', () => {
		const sym = Symbol.for('symKey');
		const obj = { __proto__: null, [sym]: Symbol.for('symVal') };
		const s = toJsex(obj);
		const parsed = parse(s);
		assert.strictEqual(parsed[sym], Symbol.for('symVal'));
	});

	await test('Error without arguments parsed', () => {
		const parsed = parse('Error()');
		assert(parsed instanceof Error);
		assert.strictEqual(parsed.message, '');
	});

	await test('multiple toJsex calls with same options', () => {
		const opts = { sorting: true };
		const s1 = toJsex({ b: 2, a: 1 }, opts);
		const s2 = toJsex({ d: 4, c: 3 }, opts);
		// Ensure options are not mutated
		assert(s1.indexOf('"a"') < s1.indexOf('"b"'));
		assert(s2.indexOf('"c"') < s2.indexOf('"d"'));
	});

	await test('function with rest params', () => {
		const fn = function (...args) { return args.length; };
		const s = toJsex(fn);
		const parsed = parse(s);
		assert.strictEqual(parsed(1, 2, 3), 3);
	});

	await test('function with default params', () => {
		const fn = function (a = 10) { return a; };
		const s = toJsex(fn);
		const parsed = parse(s);
		assert.strictEqual(parsed(), 10);
		assert.strictEqual(parsed(5), 5);
	});

	await test('Set and Map with unsupported values skip them', () => {
		const set = new Set([1, console.log, 3]);
		const s = toJsex(set);
		const parsed = parse(s);
		assert(parsed instanceof Set);
		assert(parsed.has(1));
		assert(parsed.has(3));
		assert.strictEqual(parsed.size, 2); // native function skipped
	});

	await test('Map with unsupported key skips entry', () => {
		const map = new Map([[1, 'one'], [console.log, 'fn']]);
		const s = toJsex(map);
		const parsed = parse(s);
		assert(parsed instanceof Map);
		assert.strictEqual(parsed.get(1), 'one');
		assert.strictEqual(parsed.size, 1); // native function key skipped
	});

	await test('Map with unsupported value skips entry', () => {
		const map = new Map([[1, 'one'], [2, console.log]]);
		const s = toJsex(map);
		const parsed = parse(s);
		assert(parsed instanceof Map);
		assert.strictEqual(parsed.get(1), 'one');
		assert.strictEqual(parsed.size, 1); // native function value skipped
	});

	await test('Float16Array roundtrip', () => {
		if (typeof Float16Array !== 'undefined') {
			const arr = new Float16Array([1.5, 2.5]);
			const s = toJsex(arr);
			const parsed = parse(s);
			assert(parsed instanceof Float16Array);
			assert.strictEqual(parsed.length, 2);
		}
	});

	// ─── Edge Cases added during Verification ──────────────
	section('Verification - Added Edge Cases');

	await test('scientific notation variant 1e05', () => {
		const result = '1e05'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 1);
		assert.strictEqual(result.length, 1); // parses '1', leaving 'e05'
	});

	await test('scientific notation variant 1e-05', () => {
		const result = '1e-05'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 1);
		assert.strictEqual(result.length, 1); // parses '1', leaving 'e-05'
	});

	await test('scientific notation illegal exponent 1e', () => {
		const result = '1e'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 1);
		assert.strictEqual(result.length, 1);
	});

	await test('scientific notation illegal exponent 1.5e-', () => {
		const result = '1.5e-'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 1.5);
		assert.strictEqual(result.length, 3); // parses '1.5'
	});

	await test('number with leading zeros 0123', () => {
		const result = '0123'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 0);
		assert.strictEqual(result.length, 1); // parses '0', leaving '123'
	});

	await test('dot-first decimal .1', () => {
		const result = '.1'.parseJsex();
		assert.strictEqual(result, undefined);
	});

	await test('numeric separator 1_000', () => {
		const result = '1_000'.parseJsex();
		assert(result);
		assert.strictEqual(result.value, 1);
		assert.strictEqual(result.length, 1); // parses '1', leaving '_000'
	});

	await test('invalid unicode brace escape \\u{110000}', () => {
		assert.strictEqual('"\\u{110000}"'.parseJsex(), undefined);
	});

	await test('invalid unicode brace escape empty \\u{}', () => {
		assert.strictEqual('"\\u{}"'.parseJsex(), undefined);
	});

	await test('invalid hex escape \\x', () => {
		assert.strictEqual('"\\x"'.parseJsex(), undefined);
		assert.strictEqual('"\\xG"'.parseJsex(), undefined);
		assert.strictEqual('"\\x1"'.parseJsex(), undefined);
	});

	await test('invalid unicode escape \\u', () => {
		assert.strictEqual('"\\u"'.parseJsex(), undefined);
		assert.strictEqual('"\\uFFF"'.parseJsex(), undefined);
		assert.strictEqual('"\\u123"'.parseJsex(), undefined);
	});

	await test('trailing backslash in string', () => {
		const s = toJsex("abc\\");
		assert.strictEqual(s, '"abc\\\\"');
		assert.strictEqual(parse(s), "abc\\");
	});

	await test('unquoted object key is rejected', () => {
		assert.strictEqual('{a: 1, "__proto__": null}'.parseJsex(), undefined);
	});

	await test('numeric object key is rejected', () => {
		assert.strictEqual('{1: 2, "__proto__": null}'.parseJsex(), undefined);
	});

	await test('trailing comma in object is rejected', () => {
		assert.strictEqual('{"a": 1, "__proto__": null,}'.parseJsex(), undefined);
	});

	await test('prototype pollution prevention via __proto__', () => {
		// Verify that __proto__ property is safely ignored/dropped
		const parsed = parse('{"__proto__": {"polluted": true}, "a": 1}');
		assert.strictEqual(Object.getPrototypeOf(parsed), null);
		assert(!("polluted" in parsed));
		assert.strictEqual(parsed.a, 1);
	});

	await test('prototype pollution prevention via computed ["__proto__"]', () => {
		// Even if computed property keys are parsed, prototype is null and not polluted
		const parsed = parse('{["__proto__"]: {"polluted": true}, "a": 1}');
		assert.strictEqual(Object.getPrototypeOf(parsed), null);
		assert.strictEqual(parsed.__proto__.polluted, true); // It is just an own property
		assert.strictEqual(Object.getPrototypeOf(parsed), null);
	});

	await test('regexp invalid flag parses partially', () => {
		const result = '/abc/x'.parseJsex();
		assert(result);
		assert.strictEqual(result.value.source, 'abc');
		assert.strictEqual(result.length, 5); // parses '/abc/', ignores 'x'
	});

	await test('regexp duplicate flags is parsed partially', () => {
		const result = '/abc/gg'.parseJsex();
		assert(result);
		assert.strictEqual(result.value.flags, 'g');
		assert.strictEqual(result.length, 6); // parses '/abc/g', ignores the second 'g'
	});

	await test('function parameter list with block comment', () => {
		const fnStr = '(a /* comment */ , b) => { return a + b; }';
		const result = fnStr.parseJsex();
		assert(result);
		assert.strictEqual(typeof result.value, 'function');
		assert.strictEqual(result.value(2, 3), 5);
	});

	await test('function with template literal in body', () => {
		const fn = () => { return `hello`; };
		const s = toJsex(fn);
		const parsed = parse(s);
		assert.strictEqual(parsed(), 'hello');
	});

	await test('function with destructuring parameter', () => {
		const fn = ({ a, b: { c } }) => { return a + c; };
		const s = toJsex(fn);
		const parsed = parse(s);
		assert.strictEqual(parsed({ a: 1, b: { c: 2 } }), 3);
	});

	await test('security - async function constructor blocked', () => {
		assert.strictEqual('(async function(){}).constructor("globalThis.__jsexInjected=1")'.parseJsex(), undefined);
	});

	await test('security - generator constructor blocked', () => {
		assert.strictEqual('(function*(){}).constructor("globalThis.__jsexInjected=1")'.parseJsex(), undefined);
	});

	await test('security - async generator constructor blocked', () => {
		assert.strictEqual('(async function*(){}).constructor("globalThis.__jsexInjected=1")'.parseJsex(), undefined);
	});

	// ═══════════════════════════════════════════════════════
	// Summary
	// ═══════════════════════════════════════════════════════
	console.log(`\n${'═'.repeat(50)}`);
	console.log(`Results: ${passed} passed, ${failed} failed`);
	if (errors.length > 0) {
		console.log('\nFailed tests:');
		for (const { name, error } of errors) {
			console.log(`  ✗ ${name}`);
			console.log(`    ${error.stack?.split('\n').slice(0, 3).join('\n    ')}`);
		}
	}
	console.log('═'.repeat(50));

	if (failed > 0) {
		process.exitCode = 1;
	}
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
