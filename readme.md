## What is jsex?
jsex is an extended JSON format that supports most native javascript data types.


## How many data types does jsex support?
As many as possible, including:
* All types supported in JSON
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
By calling `toJsex(data, sorting?, jsonCompatible?)`.
* `sorting`: Whether sorting the content of `Map`, `Set` and `Object`. Defaults to `false`.
* `jsonCompatible`: Whether generating JSON compatible string. Defaults to `false`.
```javascript
import './jsex.js';
let data = {};
data.someRegex = /\wjsex\w/ig;
data.someSet = new Set();
data.someSet.add(1);
data.someSet.add(0n);
data[Symbol.for('symbolKey')] = 'valueForSymbolKey';
data.normalKey = 'valueForNormalKey';
console.log(toJsex(data));
console.log(toJsex(data, true));

let obj = {
    ["__proto__"]: '\v',
    "tab": "\t"
  },
  jsonstr = JSON.stringify(obj),
  jsexstr = toJsex(obj);
console.log('jsex:', jsexstr);
console.log('json:', jsonstr);
console.log(toJsex(obj, false, true) === jsonstr); //true
JSON.parse(toJsex(data, false, true));
//Error, jsonCompatible makes sense only if data doesn't contain extended types.
```


## How to deserialize?
Basically you can just `eval` the string if you trust the source. However if you don't, use `String.prototype.parseJsex()` instead. This method returns `undefined` if parsing failed, or an `Object` with a `length` key (to store the count of characters parsed in this string) and a `value` key (to store the real result).
```javascript
//following the above code
let evalJsex = eval('(' + jsexstr + ')'),
  parseJsex = jsexstr.parseJsex().value,
  evalJson = eval('(' + jsonstr + ')'),
  parseJson = JSON.parse(jsonstr),
  ParseJsonByJsex = jsonstr.parseJsex().value;
console.log('evalJsex:', evalJsex, 'parseJsex:', parseJsex, 'evalJson:', evalJson, 'parseJson:', parseJson, 'ParseJsonByJsex:', ParseJsonByJsex);
console.log(isEqual(evalJsex, parseJsex)); //true
console.log(isEqual(evalJson, parseJson)); //false, JSON is not a subset of javascript
console.log(isEqual(evalJson, ParseJsonByJsex)); //true
```


## Does `parseJsex` support JSON string?
Yes, but only for compact JSON strings. Any unnecessary blank space or comments may cause failing.


## Is there any other difference between JSON and jsex?
Yes, there are a few more differences.
* `0` and `-0` are different in jsex.
* `Object` in jsex has no prototype. Which means it is safe to use any key name.
* `toJsex` use `valueOf` rather then `toJSON` to serialize custom data types.


## When should I use jsex?
When you are using javascript, and JSON is not good enough for you.