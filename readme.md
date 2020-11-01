## What is jsex?
jsex is an extended JSON format which supports most of native javascript data types.


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
By calling `toJsex(data, sorting = false, jsonCompatible = false, debug = false)`.
* `sorting`: Whether sorting the content of `Map`, `Set` and `Object`.
* `jsonCompatible`: Whether generating JSON compatible string.
* `debug`: Whether throw error when meet unexpected data
```javascript
import './jsex.js';
let data = {};
data.someRegex = /\w\u2028\w\u2029/ig;
data.someSet = new Set();
data.someSet.add(1);
data.someSet.add(0n);
data.someSet.add(a => a);
data[Symbol.for('symbolKey')] = 'valueForSymbolKey';
data.normalKey = 'valueForNormalKey';
console.log('normal:', toJsex(data), '\nsorted:', toJsex(data, true));
//normal: {"__proto__":null,"someRegex":/\w\u2028\w\u2029/gi,"someSet":new Set([1,0n,Function("let [a]=arguments;\nreturn a")]),"normalKey":"valueForNormalKey",[Symbol.for("symbolKey")]:"valueForSymbolKey"}
//sorted: {"__proto__":null,"normalKey":"valueForNormalKey","someRegex":/\w\u2028\w\u2029/gi,"someSet":new Set([0n,1,Function("let [a]=arguments;\nreturn a")]),[Symbol.for("symbolKey")]:"valueForSymbolKey"}
try {
  JSON.parse(toJsex(data, false, true));
} catch(e) {
  console.log('error: jsonCompatible makes sense only if data does not contain extended types');
}

let obj = {
    ["__proto__"]: '\v',
    "tab": "\t"
  },
  jsonstr = JSON.stringify(obj),
  jsexstr = toJsex(obj);
console.log('jsexstr:', jsexstr, '\njsonstr:', jsonstr);
//jsexstr: {"__proto__":null,["__proto__"]:"","tab":"	"} 
//jsonstr: {"__proto__":"\u000b","tab":"\t"}
console.log('is compatible:', toJsex(obj, false, true) === jsonstr);
//is compatible: true
```


## How to deserialize?
Basically you can just `eval` the string if you trust the source. However if you don't, use `String.prototype.parseJsex()` instead. This method returns `undefined` if parsing failed, or an `Object` with a `length` key (to store the count of characters parsed in this string) and a `value` key (to store the real result).
```javascript
//following the above code
let evalJsex = Function('return ' + jsexstr)(),
  parseJsex = jsexstr.parseJsex().value,
  evalJson = Function('return ' + jsonstr)(),
  parseJson = JSON.parse(jsonstr),
  parseJsonByJsex = jsonstr.parseJsex().value;
console.log('evalJsex:', evalJsex, '\nparseJsex:', parseJsex, '\nevalJson:', evalJson, '\nparseJson:', parseJson, '\nparseJsonByJsex:', parseJsonByJsex);
console.log('is jsex a subset of javascript:', isEqual(evalJsex, parseJsex) && isEqual(evalJson, parseJsonByJsex));
//is jsex a subset of javascript: true
console.log('is json a subset of javascript:', isEqual(evalJson, parseJson));
//is json a subset of javascript: false
```


## What is `isEqual`?
`isEqual(a, b)` returns `true` if `toJsex(a, true) === toJsex(b, true)`. But it could be faster then that expression. You may use it to compare data structure.


## Does `parseJsex` support JSON string?
Yes, but any `__proto__` key of `Object` in JSON string will be ignored. As the above example shown.


## How to serialize a `class`?
`class` is not supported directly. However you can still store it in a function.
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
* `toJsex` does not do unnecessary string escape when `jsonCompatible` is `false`.
* `toJsex` does not skip unenumerable keys and symbol keys in `Object`.
* `toJsex` use `valueOf` rather then `toJSON` to serialize custom data types.


## When should I use jsex?
When you are using javascript, and JSON can not fit your needs.