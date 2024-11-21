## What is jsex?
jsex is a strict subset of javascript for data serialization/deserialization, which supports most of the native javascript data types.


## How many data types are supported?
As many as possible, including:
* All types supported by JSON
* function
* bigint
* symbol
* Date
* Error
* RegExp
* Set
* Map
* Typed Arrays
* Infinity, NaN and undefined


## How many browsers are supported?
It's hard to make a full list. But jsex requires some bleeding edge ES features. In order to make sure it works, you probably need to install some polyfill for your production environment.


## How to serialize data?
By calling `toJsex(data, options)`.
* `options` defaults to `{sorting: false, implicitConversion: false, jsonCompatible: false, debug: false}`.
  * `sorting`: Whether sorting the content of `Map`, `Set` and `Object`.
  * `implicitConversion`: Whether trying to resolve unrecognized type by calling its `valueOf` method.
  * `jsonCompatible`: Whether generating JSON compatible string.
  * `debug`: Whether throw error when meet unexpected data or just skip them silently.
### serializing example:
```javascript
require('jsex');
let data = {
  someRegex: RegExp('\r\u2028\n\ud800', 'ig'),
  someSet: new Set([a => a, 1, 0n]),
  [Symbol.for('symbolKey')]: 'valueForSymbolKey',
  normalKey: 'valueForNormalKey'
};
console.log('normal:', toJsex(data), '\nsorted:', toJsex(data, {sorting: true}));
//normal: {"someRegex":/\r\u2028\n\ud800/gi,"someSet":new Set([Function("a","return a"),1,0n]),"normalKey":"valueForNormalKey",[Symbol.for("symbolKey")]:"valueForSymbolKey","__proto__":null}
//sorted: {"normalKey":"valueForNormalKey","someRegex":/\r\u2028\n\ud800/gi,"someSet":new Set([0n,1,Function("a","return a")]),[Symbol.for("symbolKey")]:"valueForSymbolKey","__proto__":null}
try {
  JSON.parse(toJsex(data, {jsonCompatible: true}));
} catch(e) {
  console.log('error: jsonCompatible makes sense only if data does not contain extended types');
}
```
### another serializing example:
```javascript
let obj = {
    ["__proto__"]: '\v',
    "tab": "\t"
  },
  jsonstr = JSON.stringify(obj),
  jsexstr = toJsex(obj);
console.log('jsexstr:', jsexstr, '\njsonstr:', jsonstr);
//jsexstr: {["__proto__"]:"","tab":"	","__proto__":null}
//jsonstr: {"__proto__":"\u000b","tab":"\t"}
console.log('is compatible:', toJsex(obj, {jsonCompatible: true}) === jsonstr);
//is compatible: true
```


## How to deserialize?
Basically you can just `eval` the string if you trust the source. However if you don't, use `String.prototype.parseJsex(forbiddenMethods)` instead. This method returns `undefined` if parsing failed, or an `Object` with a `length` key (to store the count of characters parsed in this string) and a `value` key (to store the real result).
* `forbiddenMethods` defaults to a `Set` that includes all implicit methods of the current javascript engine. You probably don't want these methods cause they might be called automatically. Or you may change this param to `null` or another `Set`.
### deserializing example:
```javascript
//following the above code
let evalJsex = Function('return ' + jsexstr)(),
  parseJsex = jsexstr.parseJsex().value,
  evalJson = Function('return ' + jsonstr)(),
  parseJson = JSON.parse(jsonstr),
  parseJsonByJsex = jsonstr.parseJsex().value;
console.log('evalJsex:', evalJsex, '\nparseJsex:', parseJsex, '\nevalJson:', evalJson, '\nparseJson:', parseJson, '\nparseJsonByJsex:', parseJsonByJsex);
console.log('json is a subset of javascript?', JSON.stringify(evalJson) === JSON.stringify(parseJson));
//json is a subset of javascript? false
console.log('jsex is a subset of javascript?', JSON.stringify(evalJsex) === JSON.stringify(parseJsex) && JSON.stringify(evalJson) === JSON.stringify(parseJsonByJsex));
//jsex is a subset of javascript? true
```


## Does `parseJsex` support JSON string?
Yes, but any `__proto__` key of `Object` in JSON string will be ignored. As the above example shown.


## How to serialize a `class`?
For security reason, `class` is not supported by default. But you can still serialize it as `string` by calling `toJsex` with `implicitConversion` option set to `true`.
### class example:
```javascript
class customType {
  constructor () {
    this.args = [...arguments];
  }
  valueOf() {
    return this.args;
  }
}
let source = toJsex(customType, {implicitConversion: true});
let deserializedClass = Function('return ' + source.parseJsex().value)();
console.log(deserializedClass.toString() === customType.toString());
//true
```


## How to serialize a custom type?
You can't define custom types in jsex. But you can resolve it to a supported type by implanting a `valueOf` method. And then call `toJsex` with `implicitConversion` option set to `true`.
### custom type example:
```javascript
//following the above code
let instance1 = new customType(1, 2n, {});
let jsex = toJsex(instance1, {implicitConversion: true});
console.log(jsex);
//[1,2n,{"__proto__":null}]
let instance2 = Reflect.construct(deserializedClass, jsex.parseJsex().value);
```


## Can I use comments in jsex?
Yes, comments are allowed. But not on everywhere. Such as `-/*123*/4` is invalid in jsex.


## Is there any other difference between JSON and jsex?
Yes, there are a few more differences.
* `0` and `-0` are different in jsex.
* `Object` has no prototype, which means it is safe to use any key name.
* `toJsex` does not escape ASCII control characters (besides `\r` and `\n`) by detault.
* `toJsex` does not skip unenumerable keys and symbol keys in `Object`.


## When should I use jsex?
When you are using javascript, and JSON can not fit your needs.