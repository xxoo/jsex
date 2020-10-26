## What is jsex?
jsex is an extended JSON format which supports most of native javascript data types.


## How many data types does jsex support?
As many as possible, including:
* All types supported by JSON
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
By calling `toJsex(data, sorting = false, jsonCompatible = false)`.
* `sorting`: Whether sorting the content of `Map`, `Set` and `Object`.
* `jsonCompatible`: Whether generating JSON compatible string.
```javascript
import './jsex.js';
let data = {};
data.someRegex = /\wjsex\w/ig;
data.someSet = new Set();
data.someSet.add(1);
data.someSet.add(0n);
data[Symbol.for('symbolKey')] = 'valueForSymbolKey';
data.normalKey = 'valueForNormalKey';
console.log('normal:', toJsex(data), '\nsorted:', toJsex(data, true));
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
console.log('is compatible:', toJsex(obj, false, true) === jsonstr);
```


## How to deserialize?
Basically you can just `eval` the string if you trust the source. However if you don't, use `String.prototype.parseJsex()` instead. This method returns `undefined` if parsing failed, or an `Object` with a `length` key (to store the count of characters parsed in this string) and a `value` key (to store the real result).
```javascript
//following the above code
let evalJsex = eval('(' + jsexstr + ')'),
  parseJsex = jsexstr.parseJsex().value,
  evalJson = eval('(' + jsonstr + ')'),
  parseJson = JSON.parse(jsonstr),
  parseJsonByJsex = jsonstr.parseJsex().value;
console.log('evalJsex:', evalJsex, '\nparseJsex:', parseJsex, '\nevalJson:', evalJson, '\nparseJson:', parseJson, '\nparseJsonByJsex:', parseJsonByJsex);
console.log('is jsex a subset of javascript:', isEqual(evalJsex, parseJsex) && isEqual(evalJson, parseJsonByJsex));
console.log('is json a subset of javascript:', isEqual(evalJson, parseJson));
```


## Does `parseJsex` support JSON string?
Yes, but any `__proto__` key of `Object` in JSON string will be ignored.


## May I use comments in jsex?
Yes, comments are allowed. But not on everywhere. Such as `new/*test*/Date(/*test*/1234556789012)` is illegal.


## Is there any other difference between JSON and jsex?
Yes, there are a few more differences.
* `0` and `-0` are different in jsex.
* `Object` in jsex has no prototype, which means it is safe to use any key name.
* `toJsex` use `valueOf` rather then `toJSON` to serialize custom data types.


## When should I use jsex?
When you are using javascript, and JSON can not fit your needs.