## What is jsex?
jsex is a strict subset of javascript for data serialization/deserialization, which supports most of the native javascript data types.


## How many data types does jsex support?
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
* Typed Arrays (will be serialized as normal array)
* Infinity, NaN and undefined


## How to serialize data?
By calling `toJsex(data, options = {sorting: false, jsonCompatible: false, debug: false})`.
* `sorting`: Whether sorting the content of `Map`, `Set` and `Object`.
* `jsonCompatible`: Whether generating JSON compatible string.
* `debug`: Whether throw error when meet unexpected data or just skip them silently.
```javascript
require('jsex');
let data = {
  someRegex: /\w\u2028\w\u2029/ig,
  someSet: new Set([a => a, 1, 0n]),
  [Symbol.for('symbolKey')]: 'valueForSymbolKey',
  normalKey: 'valueForNormalKey'
};
console.log('normal:', toJsex(data), '\nsorted:', toJsex(data, {sorting: true}));
//normal: {"__proto__":null,"someRegex":/\w\u2028\w\u2029/gi,"someSet":new Set([Function("a","return a"),1,0n]),"normalKey":"valueForNormalKey",[Symbol.for("symbolKey")]:"valueForSymbolKey"}
//sorted: {"__proto__":null,"normalKey":"valueForNormalKey","someRegex":/\w\u2028\w\u2029/gi,"someSet":new Set([0n,1,Function("a","return a")]),[Symbol.for("symbolKey")]:"valueForSymbolKey"}
try {
  JSON.parse(toJsex(data, {jsonCompatible: true}));
} catch(e) {
  console.log('error: jsonCompatible makes sense only if data does not contain extended types');
}
```
```javascript
let obj = {
    ["__proto__"]: '\v',
    "tab": "\t"
  },
  jsonstr = JSON.stringify(obj),
  jsexstr = toJsex(obj);
console.log('jsexstr:', jsexstr, '\njsonstr:', jsonstr);
//jsexstr: {"__proto__":null,["__proto__"]:"","tab":"	"}
//jsonstr: {"__proto__":"\u000b","tab":"\t"}
console.log('is compatible:', toJsex(obj, {jsonCompatible: true}) === jsonstr);
//is compatible: true
```


## How to deserialize?
Basically you can just `eval` the string if you trust the source. However if you don't, use `String.prototype.parseJsex(allowImplicitMethods = false)` instead. This method returns `undefined` if parsing failed, or an `Object` with a `length` key (to store the count of characters parsed in this string) and a `value` key (to store the real result).
* `allowImplicitMethods`: Whether allow methods that might be called implicitly. Such as `toString` and `valueOf`.
```javascript
//following the above code
let evalJsex = Function('return ' + jsexstr)(),
  parseJsex = jsexstr.parseJsex().value,
  evalJson = Function('return ' + jsonstr)(),
  parseJson = JSON.parse(jsonstr),
  parseJsonByJsex = jsonstr.parseJsex().value;
console.log('evalJsex:', evalJsex, '\nparseJsex:', parseJsex, '\nevalJson:', evalJson, '\nparseJson:', parseJson, '\nparseJsonByJsex:', parseJsonByJsex);
console.log('is json a subset of javascript:', JSON.stringify(evalJson) === JSON.stringify(parseJson));
//is json a subset of javascript: false
console.log('is jsex a subset of javascript:', JSON.stringify(evalJsex) === JSON.stringify(parseJsex) && JSON.stringify(evalJson) === JSON.stringify(parseJsonByJsex));
//is jsex a subset of javascript: true
```


## Does `parseJsex` support JSON string?
Yes, but any `__proto__` key of `Object` in JSON string will be ignored. As the above example shown.


## How to serialize a `class`?
`class` is not supported directly. However you can still wrap it with a function.
```javascript
console.log(toJsex(base => class extends base {
  constructor() {
    super(...arguments);
  }
}));
//Function("base","return class extends base {\n  constructor() {\n    super(...arguments);\n  }\n}")
```


## Can I use comments in jsex?
Yes, comments are allowed. But not on everywhere. Such as `-/*123*/4` is invalid in jsex.


## Is there any other difference between JSON and jsex?
Yes, there are a few more differences.
* `0` and `-0` are different in jsex.
* `Object` has no prototype, which means it is safe to use any key name.
* `toJsex` does not escape ASCII control characters (except `\r` and `\n`) by detault.
* `toJsex` does not skip unenumerable keys and symbol keys in `Object`.
* `toJsex` use `valueOf` rather then `toJSON` to serialize custom data types.


## When should I use jsex?
When you are using javascript, and JSON can not fit your needs.