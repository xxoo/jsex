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
data.someRegex = /\wjsex\w/ig;
data.someSet = new Set();
data.someSet.add(1);
data.someSet.add(1n);
data[Symbol.for('symbolkey')] = 'valueForSymbolKey';
data.normalKey = 'valueForNormalKey';
let s = toJsex(data);
console.log(s);
//{"someRegex":/\wjsex\w/gi,"someSet":new Set([1,1n]),"normalKey":"valueForNormalKey",[Symbol.for("symbolkey")]:"valueForSymbolKey"}
```

## How to deserialize?
Basically you can just `eval` the string to restore data. but for security reason you might need to use `String.prototype.parseJsex()`.
```javascript
//to undertake the above code
console.log('eval result:', eval('(' + s + ')'));
//parseJsex returns undefined if parsing failed.
//or an object with a length key(characters parsed in this string) and a value key(the result).
console.log('parseJsex result:', s.parseJsex().value);
```

## Does `parseJsex` support JSON string?
Yes, but only for compact JSON strings. Any unnecessary blank space or commants may cause failing.

## Is there any other difference between JSON and jsex?
Yes, there are a few differences.
* `toJsex` use `valueOf` rather then `toJSON` to serialize custom data types
* When serializing strings, jsex doesn't do unnecessary escapes, most unicode characters will be as is. ASCII control characters will be escaped as `\x00` alike.
* `0` and `-0` are different in jsex
* Objects returned from `parseJsex` have a `null` prototype. Which means it is safe to use any key name. except `__proto__`.
* You can choose whether or not sorting the keys in `toJsex(data, sorting)`. In some particular cases it makes sance. eg: Comparing data structure

## When should I use jsex?
When your javascript project needs to store data, or share data between other javascript projects, and JSON is not good enough for you. Then it is recommend to try out jsex.