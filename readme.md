## What is jsex?
jsex is an extended JSON data format that supports most native javascript data types.

## How many data types does jsex support?
* All types that supported in JSON
* Date
* RegExp
* Bigint
* Error
* Symbol
* Set
* Map
* Typed Arrays (will be serialized as normal array)
* Infinity, NaN and undefined

## How to serialize data?
By calling `toJsex(data)`.
```javascript
import './jsex.js';
let data = {};
data.normalKey = 'valueForNormalKey';
data[Symbol.for('symbolkey')] = 'valueForSymbolKey';
data.someRegex = /\wjsex\w/ig;
data.someSet = new Set();
data.someSet.add(1);
data.someSet.add(1n);
let s = toJsex(data);
console.log(s);
//{"normalKey":"valueForNormalKey","someRegex":/\wjsex\w/gi,"someSet":new Set([1,1n]),[Symbol.for("symbolkey")]:"valueForSymbolKey"}
```

## How to deserialize?
Normally you can just `eval` the string to restore data. but for security reason you might need to use `String.prototype.parseJsex()`.
```javascript
//to undertake the above code
console.log('eval result:', eval(`(${s})`));
//parseJsex returns undefined if failed to parse the string. or it will return an object with a length key and a value key.
console.log('parseJsex result:', s.parseJsex().value);
```

## Does `parseJsex` support JSON string?
Yes, but only for compact JSON strings. Any unnecessary blank space or commants may cause failing.

## Is there any other difference between JSON and jsex?
Yes, there are a few differences.
* When serializing strings, jsex doesn't do unnecessary escapes, most unicode characters will be as is. ASCII control characters will be escaped as `\x00` alike.
* `0` and `-0` are different in jsex
* Objects don't have prototype when deserializing with `parseJsex`. Which means it is safe to use any key name. except `__proto__`.

## When should I use jsex?
When you are transfering data between javascript projects, and JSON is not good enough for you. It is recommend to try out jsex.