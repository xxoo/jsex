## What is jsex?
jsex is an extended JSON format that supports most native javascript data types.


## How many data types does jsex support?
As many as possible, including:
* All types supported in JSON
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
By calling `toJsex(data, sorting, jsonCompatible)`. `sorting` and `jsonCompatible` default to `false`, here is an example:
```javascript
import './jsex.js';
let data = {};
data.someRegex = /\wjsex\w/ig;
data.someSet = new Set();
data.someSet.add(1);
data.someSet.add(1n);
data[Symbol.for('symbolKey')] = 'valueForSymbolKey';
data.normalKey = 'valueForNormalKey';
let s = toJsex(data);
console.log(s);
//{"someRegex":/\wjsex\w/gi,"someSet":new Set([1,1n]),"normalKey":"valueForNormalKey",[Symbol.for("symbolKey")]:"valueForSymbolKey"}
```


## How to deserialize?
Basically you can just `eval` the string to restore data. But for security reasons you might need to use `String.prototype.parseJsex()`. This method returns undefined if parsing failed, or an object with a `length` key(characters parsed in this string) and a `value` key(the result).
```javascript
//following the above code
let v1 = eval('(' + s + ')'),
  v2 = s.parseJsex().value;
console.log('eval result:', v1);
console.log('parseJsex result:', v2);
console.log(isEqual(v1, v2)); //true
```


## Does `parseJsex` support JSON string?
Yes, but only for compact JSON strings. Any unnecessary blank space or commants may cause failing.


## Is there any other difference between JSON and jsex?
Yes, there are a few more differences.
* `0` and `-0` are different in jsex
* Deserialized Object (from `parseJsex`) has a `null` prototype. Which means it is safe to use any key name. except `__proto__`.
* `toJsex` use `valueOf` rather then `toJSON` to serialize custom data types
* You can choose whether or not sorting the keys with the 2nd argument of `toJsex`. It makes sence in some particular cases. eg: Comparing data structure.
* By default jsex doesn't use JSON style string escaping. You can change this behavior with the 3rd argument of `toJsex`. It makes sence if the data you're serializing doesn't contain extended types.


## When should I use jsex?
When you are using javascript, and JSON is not good enough for you.