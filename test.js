const assert = require('assert');

require('./jsex.js');

const realType = value => Object.prototype.toString.call(value).slice(8, -1);
const parse = source => {
	const result = source.parseJsex();
	assert(result, source);
	assert.strictEqual(result.length, source.length, source);
	return result.value;
};

(async () => {
	function named(a) { return a; }
	const anon = function (a) { return a; },
		arrow = a => a,
		asyncArrow = async a => a,
		gen = function* namedGenerator(a) { yield a; },
		asyncFn = async function namedAsync(a) { return a; },
		asyncGen = async function* namedAsyncGenerator(a) { yield a; },
		methods = {
			method(a) { return a; },
			async asyncMethod(a) { return a; },
			*generatorMethod(a) { yield a; },
			async *asyncGeneratorMethod(a) { yield a; },
			get getter() { return 1; },
			set setter(v) { this.value = v; }
		};

	const getter = Object.getOwnPropertyDescriptor(methods, 'getter').get,
		setter = Object.getOwnPropertyDescriptor(methods, 'setter').set,
		cases = [
			[named, 'function(a) { return a; }', value => assert.strictEqual(value(2), 2)],
			[anon, 'function(a) { return a; }', value => assert.strictEqual(value(2), 2)],
			[arrow, '(a)=>{return a}', value => assert.strictEqual(value(2), 2)],
			[asyncArrow, 'async (a)=>{return a}', async value => assert.strictEqual(await value(2), 2)],
			[gen, 'function*(a) { yield a; }', value => assert.strictEqual(value(2).next().value, 2)],
			[asyncFn, 'async function(a) { return a; }', async value => assert.strictEqual(await value(2), 2)],
			[asyncGen, 'async function*(a) { yield a; }', async value => assert.strictEqual((await value(2).next()).value, 2)],
			[methods.method, 'function(a) { return a; }', value => assert.strictEqual(value(2), 2)],
			[methods.asyncMethod, 'async function(a) { return a; }', async value => assert.strictEqual(await value(2), 2)],
			[methods.generatorMethod, 'function*(a) { yield a; }', value => assert.strictEqual(value(2).next().value, 2)],
			[methods.asyncGeneratorMethod, 'async function*(a) { yield a; }', async value => assert.strictEqual((await value(2).next()).value, 2)],
			[getter, 'function() { return 1; }', value => assert.strictEqual(value(), 1)],
			[setter, 'function(v) { this.value = v; }', value => {
				const target = {};
				value.call(target, 3);
				assert.strictEqual(target.value, 3);
			}]
		];

	for (const [fn, expected, check] of cases) {
		const source = toJsex(fn);
		assert.strictEqual(source, expected);
		const value = parse(source);
		assert.strictEqual(realType(value), realType(fn));
		await check(value);
	}

	const withAccessor = {};
	Object.defineProperty(withAccessor, 'fromGetter', {
		get() { return 7; }
	});
	Object.defineProperty(withAccessor, 'setterOnly', {
		set(v) { this.value = v; }
	});
	const accessorValue = parse(toJsex(withAccessor));
	assert.strictEqual(accessorValue.fromGetter, 7);
	assert.strictEqual(accessorValue.setterOnly, undefined);
	assert(!('value' in accessorValue));

	let result = '\n/* lead */ // line\n[1,2]'.parseJsex();
	assert(result);
	assert.strictEqual(result.length, '\n/* lead */ // line\n[1,2]'.length);
	assert.deepStrictEqual(result.value, [1, 2]);

	result = 'nullx'.parseJsex();
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
	assert.strictEqual(parse('new Date(5)').getTime(), 5);
	assert.deepStrictEqual([...parse('new Map([[1,"one"]])')], [[1, 'one']]);
	assert.deepStrictEqual([...parse('new Uint16Array([1,2])')], [1, 2]);
	assert.strictEqual(parse('Symbol.iterator'), Symbol.iterator);
	assert.strictEqual(parse('Error("bad")').message, 'bad');
	assert.strictEqual(parse('SyntaxError("bad")').message, 'bad');
	assert.strictEqual(parse('/a/g').global, true);
	assert.strictEqual(parse('(a)=>{return a}')(3), 3);

	const nested = parse('{"items":[/*a*/new Date(5), new Set([1,"x"]), new Map([[1,"one"]]), Symbol.for("jsex-test"), new Uint8Array([1,2]), TypeError("bad")],"__proto__":null}');
	assert.strictEqual(nested.items[0].getTime(), 5);
	assert.deepStrictEqual([...nested.items[1]], [1, 'x']);
	assert.deepStrictEqual([...nested.items[2]], [[1, 'one']]);
	assert.strictEqual(nested.items[3], Symbol.for('jsex-test'));
	assert.deepStrictEqual([...nested.items[4]], [1, 2]);
	assert.strictEqual(nested.items[5].message, 'bad');
	assert(!('__proto__' in nested));

	delete globalThis.__jsexInjected;
	result = 'function(){};globalThis.__jsexInjected=1'.parseJsex();
	assert(result);
	assert.strictEqual(result.length, 'function(){}'.length);
	assert.strictEqual(typeof result.value, 'function');
	assert.strictEqual(globalThis.__jsexInjected, undefined);

	result = 'a=>a;globalThis.__jsexInjected=1'.parseJsex();
	assert.strictEqual(result, undefined);
	assert.strictEqual(globalThis.__jsexInjected, undefined);

	result = '()=>globalThis.__jsexInjected=1'.parseJsex();
	assert.strictEqual(result, undefined);
	assert.strictEqual(globalThis.__jsexInjected, undefined);

	result = '()=>{globalThis.__jsexInjected=1};globalThis.__jsexInjected=2'.parseJsex();
	assert(result);
	assert.strictEqual(result.length, '()=>{globalThis.__jsexInjected=1}'.length);
	assert.strictEqual(globalThis.__jsexInjected, undefined);
	result.value();
	assert.strictEqual(globalThis.__jsexInjected, 1);
	delete globalThis.__jsexInjected;

	assert.strictEqual('Function("globalThis.__jsexInjected=1")'.parseJsex(), undefined);
	assert.strictEqual('(async()=>{}).constructor("globalThis.__jsexInjected=1")'.parseJsex(), undefined);
	result = 'function*(){}.constructor("a","yield a")'.parseJsex();
	assert(result);
	assert.strictEqual(result.length, 'function*(){}'.length);
	assert.strictEqual(parse('TypeError("bad")').message, 'bad');

	const source = toJsex([
		1,
		-0,
		2n,
		Symbol.for('jsex-test'),
		new Date(5),
		/a[,}]b/gi,
		new Set([1, 'x']),
		new Map([[1, 'one']]),
		new Uint8Array([1, 2]),
		new Float32Array([1.5, 2.5])
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
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
