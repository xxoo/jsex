// jsex version: 2.0.2
// https://github.com/xxoo/jsex
(() => {
	'use strict';
	const implicitMethods = new Set(['toString', 'toLocaleString', 'toJSON', 'valueOf', 'then']),
		jsNumberTokenRegExp = /(?:0[xX][\dA-Fa-f](?:_?[\dA-Fa-f])*n?|0[bB][01](?:_?[01])*n?|0[oO][0-7](?:_?[0-7])*n?|(?:\d(?:_?\d)*)(?:\.(?:\d(?:_?\d)*)?)?(?:[eE][+-]?\d(?:_?\d)*)?n?|\.(?:\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?)/y,
		symbolPropertyRegExp = /\.([\w$][\d\w$]*)/y,
		bigintRegExp = /(-?)([1-9]\d*|0(?:[bB][01]+|[oO][0-7]+|[xX][\dA-Fa-f]+)?)n/y,
		numberRegExp = /(-?)(Infinity|0(?:[bB][01]+|[oO][0-7]+|[xX][\dA-Fa-f]+)|[1-9](?:\.\d+)?[eE][-+]?[1-9]\d*|(?:[1-9]\d*|0)(?:\.\d+)?)/y,
		stringRegExp = /"((?:[^\r\n"\\]|\\(?:\r\n?|[^\r]))*)"/y,
		regExpRegExp = /\/(?!\*)((?:[^[/\\\r\n\u2028\u2029]|\\.|\[(?:[^\r\n\u2028\u2029\]\\]|\\.)*\])+)\/(d?g?i?m?s?u?y?)/y,
		typedArrayRegExp = /new (Int8|Uint8|Uint8Clamped|Int16|Uint16|Int32|Uint32|Float16|Float32|Float64|BigInt64|BigUint64)Array\(/y,
		errorRegExp = /((?:Eval|Range|Reference|Syntax|Type|URI)?Error)\(/y,
		controlWords = ['if', 'while', 'for', 'with', 'switch', 'catch'],
		exprWords = ['return', 'throw', 'case', 'delete', 'void', 'typeof', 'new', 'in', 'instanceof', 'extends', 'of', 'yield', 'await', 'else', 'do'],
		blanklength = (s, i = 0) => {
			const start = i;
			while (i < s.length) {
				if (/\s/.test(s[i])) {
					++i;
				} else if (s[i] === '/' && s[i + 1] === '*') {
					const n = s.indexOf('*/', i + 2);
					if (n < 0) break;
					i = n + 2;
				} else if (s[i] === '/' && s[i + 1] === '/') {
					i += 2;
					while (i < s.length && !isLine(s[i])) ++i;
				} else {
					break;
				}
			}
			return i - start;
		},
		isLine = c => c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029',
		isIdStart = c => c !== undefined && /[A-Za-z_$]/.test(c),
		isIdPart = c => c !== undefined && /[\dA-Za-z_$]/.test(c),
		isPunct = c => c === undefined || /[\s()[\]{}"'`/\\.,;?:~!%^&*+\-=<>|]/.test(c),
		skipblank = (s, i = 0) => i + blanklength(s, i),
		trimblankend = (s, start, end) => {
			while (end > start && /\s/.test(s[end - 1])) --end;
			return end;
		},
		matchAt = (r, s, i) => {
			r.lastIndex = i;
			return r.exec(s);
		},
		blockcommentlength = (s, i) => {
			const n = s.indexOf('*/', i + 2);
			return n < 0 ? undefined : n + 2;
		},
		linecommentlength = (s, i) => {
			while (i < s.length && !isLine(s[i])) ++i;
			return i;
		},
		stringlength = (s, i) => {
			const q = s[i++];
			while (i < s.length && s[i] !== q) {
				i += s[i] === '\\' ? isLine(s[i + 1]) && s[i + 1] === '\r' && s[i + 2] === '\n' ? 3 : 2 : 1;
			}
			return i < s.length ? i + 1 : undefined;
		},
		regexlength = (s, i) => {
			let c,
				inClass = false,
				start = ++i;
			while (i < s.length) {
				c = s[i];
				if (c === '\\') {
					i += 2;
				} else if (inClass) {
					inClass = c !== ']';
					++i;
				} else if (c === '[') {
					inClass = true;
					++i;
				} else if (c === '/' || isLine(c)) {
					if (c === '/') {
						const body = s.slice(start, i),
							flagStart = ++i;
						while (isIdPart(s[i])) ++i;
						try {
							RegExp(body, s.slice(flagStart, i));
							return i;
						} catch (e) { }
					}
					return;
				} else {
					++i;
				}
			}
		},
		jsnumberlength = (s, i) => {
			const m = matchAt(jsNumberTokenRegExp, s, i);
			return m && jsNumberTokenRegExp.lastIndex;
		},
		unicodeescapelength = (s, i) => {
			if (s[i + 2] !== '{') return i + 6;
			i += 3;
			while (i < s.length && s[i] !== '}') ++i;
			return i < s.length ? i + 1 : undefined;
		},
		sectionword = (s, i) => {
			const start = i;
			let escaped = false;
			if (s[i] === '\\') {
				escaped = true;
				i = unicodeescapelength(s, i);
			} else if (isIdStart(s[i])) {
				++i;
			} else {
				while (!isPunct(s[i])) ++i;
				return [start, i, true];
			}
			while (isIdPart(s[i]) || s[i] === '\\') {
				if (s[i] === '\\') {
					escaped = true;
					i = unicodeescapelength(s, i);
				} else {
					++i;
				}
			}
			return [start, i, escaped];
		},
		sectionwordis = (s, w, v) => !w[2] && w[1] - w[0] === v.length && s.startsWith(v, w[0]),
		sectionwordin = (s, w, values) => {
			if (w[2]) return false;
			const n = w[1] - w[0];
			for (let i = 0; i < values.length; ++i) {
				if (n === values[i].length && s.startsWith(values[i], w[0])) return true;
			}
			return false;
		},
		templatelength = (s, i) => {
			++i;
			while (i < s.length && s[i] !== '`') {
				if (s[i] === '\\') {
					i += 2;
				} else if (s[i] === '$' && s[i + 1] === '{') {
					i = sectionlength(s, i + 1, '}');
					if (i === undefined) return;
				} else {
					++i;
				}
			}
			return i < s.length ? i + 1 : undefined;
		},
		// end is the closing character
		sectionlength = (s, i, end) => {
			const stack = [{
				close: end,
				kind: 'root'
			}];
			let arrowBody = false,
				asyncStart,
				classState,
				control = false,
				controlBody = false,
				expr = true,
				fn,
				fnBody,
				methodBody = false,
				statementStart = false;
			++i;
			while (i < s.length) {
				const c = s[i],
					top = stack[stack.length - 1];
				if (/\s/.test(c)) {
					++i;
				} else if (s.startsWith('//', i)) {
					i = linecommentlength(s, i + 2);
				} else if (s.startsWith('/*', i)) {
					i = blockcommentlength(s, i);
					if (i === undefined) return;
				} else if (s.startsWith('<!--', i)) {
					i = linecommentlength(s, i + 4);
				} else if (c === top.close) {
					++i;
					const entry = stack.pop();
					if (entry.kind === 'root') return i;
					if (entry.kind === 'fnParams') {
						fnBody = entry.after;
						expr = true;
					} else if (entry.kind === 'control') {
						controlBody = true;
						expr = statementStart = true;
					} else {
						const parentKind = stack[stack.length - 1].kind;
						if (entry.kind === 'paren' && (parentKind === 'object' || parentKind === 'class')) methodBody = true;
						expr = entry.after;
						statementStart = entry.kind === 'block';
					}
				} else if (c === '"' || c === '\'') {
					arrowBody = controlBody = methodBody = false;
					i = stringlength(s, i);
					if (i === undefined) return;
					expr = statementStart = false;
					asyncStart = undefined;
				} else if (c === '`') {
					arrowBody = controlBody = methodBody = false;
					i = templatelength(s, i);
					if (i === undefined) return;
					expr = statementStart = false;
					asyncStart = undefined;
				} else if (c === '/') {
					arrowBody = controlBody = methodBody = false;
					asyncStart = undefined;
					if (expr) {
						const n = regexlength(s, i);
						if (n) {
							i = n;
							expr = statementStart = false;
						} else {
							++i;
						}
					} else {
						++i;
						expr = true;
					}
				} else if (c === '(') {
					arrowBody = controlBody = methodBody = false;
					const entry = fn ? {
						after: fn.after,
						close: ')',
						kind: 'fnParams'
					} : control ? {
						close: ')',
						kind: 'control'
					} : {
						after: false,
						close: ')',
						kind: 'paren'
					};
					stack.push(entry);
					expr = true;
					statementStart = entry.kind === 'block' || entry.kind === 'function' || entry.kind === 'arrow';
					fn = control = false;
					asyncStart = undefined;
					++i;
				} else if (c === '[') {
					arrowBody = controlBody = methodBody = false;
					asyncStart = undefined;
					const entry = {
						after: false,
						close: ']',
						kind: 'bracket'
					};
					stack.push(entry);
					expr = true;
					statementStart = false;
					++i;
				} else if (c === '{') {
					asyncStart = undefined;
					const kind = fnBody !== undefined || methodBody ? 'function' : arrowBody ? 'arrow' : classState && classState.depth === stack.length ? 'class' : controlBody || statementStart || !expr ? 'block' : 'object',
						entry = {
							after: kind === 'block' ? true : kind === 'function' ? fnBody : kind === 'class' ? classState.after : false,
							close: '}',
							kind
						};
					stack.push(entry);
					expr = true;
					statementStart = kind === 'block' || kind === 'function' || kind === 'arrow';
					if (kind === 'class') classState = false;
					fnBody = undefined;
					arrowBody = controlBody = methodBody = false;
					++i;
				} else if (/\d/.test(c) || c === '.' && /\d/.test(s[i + 1])) {
					arrowBody = controlBody = methodBody = false;
					i = jsnumberlength(s, i);
					expr = statementStart = false;
					asyncStart = undefined;
				} else if (isIdStart(c) || c === '\\' || !isPunct(c)) {
					const w = sectionword(s, i);
					arrowBody = controlBody = methodBody = false;
					i = w[1];
					if (i === undefined) return;
					if (sectionwordis(s, w, 'async')) {
						asyncStart = statementStart;
						expr = statementStart = false;
					} else {
						if (sectionwordis(s, w, 'function')) {
							fn = {
								after: asyncStart !== undefined ? asyncStart : statementStart
							};
							asyncStart = undefined;
						} else if (sectionwordis(s, w, 'class')) {
							classState = {
								after: statementStart,
								depth: stack.length
							};
							asyncStart = undefined;
							expr = true;
						} else if (sectionwordin(s, w, controlWords)) {
							asyncStart = undefined;
							control = expr = true;
						} else if (sectionwordin(s, w, exprWords)) {
							asyncStart = undefined;
							expr = true;
						} else {
							asyncStart = undefined;
							expr = false;
						}
						statementStart = false;
					}
				} else if (s.startsWith('=>', i)) {
					i += 2;
					arrowBody = expr = true;
					asyncStart = undefined;
				} else {
					arrowBody = controlBody = methodBody = false;
					i += s.startsWith('...', i) ? 3 : s.startsWith('++', i) || s.startsWith('--', i) ? 2 : 1;
					expr = c === '.' ? false : !')]}'.includes(c);
					statementStart = c === ';';
					asyncStart = undefined;
				}
			}
		},
		isWord = (s, i, w) => s.startsWith(w, i) && isPunct(s[i + w.length]),
		methodnamelength = (s, i) => {
			let l;
			if (s[i] === '[') {
				l = sectionlength(s, i, ']');
				return l && l - i;
			} else if (s[i] === '"' || s[i] === '\'') {
				l = stringlength(s, i);
				return l && l - i;
			} else {
				const start = i,
					m = matchAt(jsNumberTokenRegExp, s, i);
				if (m) return jsNumberTokenRegExp.lastIndex - i;
				while (!isPunct(s[i])) ++i;
				return i - start;
			}
		},
		functionsource = v => {
			let bodyEnd, bodyStart, l, nameEnd, nameStart, paramsEnd, paramsStart, isArrow, isBlock, isGenerator, isAsync,
				i = 0;
			if (isWord(v, 0, 'async')) {
				i = skipblank(v, 5);
				isAsync = 1;
			} else if (isWord(v, 0, 'get') || isWord(v, 0, 'set')) {
				i = skipblank(v, 3);
			}
			if (isWord(v, i, 'function')) {
				i = skipblank(v, i + 8);
				if (isAsync === 1) {
					isAsync = 2;
				}
			}
			if (v[i] === '*') {
				isGenerator = true;
				i = skipblank(v, i + 1);
			}
			l = methodnamelength(v, i);
			if (l) {
				nameStart = i;
				nameEnd = i + l;
				i = skipblank(v, nameEnd);
			}
			if (v.startsWith('=>', i)) {
				isArrow = true;
				if (nameEnd) {
					paramsStart = nameStart;
					paramsEnd = nameEnd;
					if (isAsync === 1) {
						isAsync = 2;
					}
				} else {
					paramsStart = 0;
					if (isAsync === 1) {
						paramsEnd = 5;
						isAsync = 0;
					} else {
						paramsEnd = 3;
					}
				}
				i = skipblank(v, i + 2);
			}
			if (!paramsEnd && v[i] === '(') {
				paramsStart = i;
				paramsEnd = sectionlength(v, i, ')');
				i = skipblank(v, paramsEnd);
				if (isAsync === 1 && nameEnd) {
					isAsync = 2;
				}
			}
			if (v.startsWith('=>', i)) {
				isArrow = true;
				i = skipblank(v, i + 2);
				if (isAsync === 1) {
					isAsync = 2;
				}
			}
			bodyStart = skipblank(v, i);
			isBlock = v[bodyStart] === '{';
			bodyEnd = v.length;
			while (v[bodyStart] === '(') {
				const n = sectionlength(v, bodyStart, ')');
				if (n && skipblank(v, n) === bodyEnd) {
					bodyStart = skipblank(v, bodyStart + 1);
					bodyEnd = trimblankend(v, bodyStart, n - 1);
				} else {
					break;
				}
			}
			let source = '';
			if (isAsync === 2) {
				source += 'async';
			}
			if (!isArrow) {
				if (source) {
					source += ' ';
				}
				source += 'function';
			}
			if (isGenerator) {
				source += '*';
			}
			if (v[paramsStart] !== '(') {
				source += '(';
			}
			source += v.slice(paramsStart, paramsEnd);
			if (v[paramsEnd - 1] !== ')') {
				source += ')';
			}
			if (isArrow) {
				source += '=>';
			}
			if (!isBlock) {
				source += '{return ';
			}
			source += v.slice(bodyStart, bodyEnd);
			if (!isBlock) {
				source += '}';
			}
			return source;
		},
		functionlength = (s, start = 0) => {
			let l,
				i = start,
				fn = false;
			if (isWord(s, start, 'async')) {
				i = skipblank(s, start + 5);
				if (i === start + 5 && s[i] !== '(') return;
			}
			if (isWord(s, i, 'function')) {
				fn = true;
				i = skipblank(s, i + 8);
				if (s[i] === '*') {
					i = skipblank(s, i + 1);
				}
			}
			if (s[i] !== '(' || !(l = sectionlength(s, i, ')'))) return;
			i = skipblank(s, l);
			if (!fn) {
				if (!s.startsWith('=>', i)) return;
				i = skipblank(s, i + 2);
			}
			if (s[i] !== '{' || !(l = sectionlength(s, i, '}'))) return;
			return l;
		},
		escapeStr = str => '"' + str.replace(/[\ud800-\udbff][\udc00-\udfff]|([\ud800-\udfff])|([\r\n\\"])/g, (p0, p1, p2) => {
			if (p1) {
				return '\\u' + p1.charCodeAt(0).toString(16);
			} else if (p2) {
				return {
					'"': '\\"',
					'\n': '\\n',
					'\r': '\\r',
					'\\': '\\\\',
					__proto__: null
				}[p2];
			} else {
				return p0;
			}
		}) + '"',
		escapeStrJson = str => '"' + str.replace(/[\ud800-\udbff][\udc00-\udfff]|([\ud800-\udfff])|([\0-\37\\"])/g, (p0, p1, p2) => {
			if (p1) {
				return '\\u' + p1.charCodeAt(0).toString(16);
			} else if (p2) {
				const n = {
					'"': '\\"',
					'\n': '\\n',
					'\r': '\\r',
					'\t': '\\t',
					'\b': '\\b',
					'\f': '\\f',
					'\\': '\\\\',
					__proto__: null
				};
				if (p2 in n) {
					return n[p2];
				} else {
					const c = p2.charCodeAt(0);
					return '\\u00' + (c < 16 ? '0' : '') + c.toString(16);
				}
			} else {
				return p0;
			}
		}) + '"',
		getRealType = data => {
			const t = Object.prototype.toString.call(data);
			return t.slice(8, t.length - 1);
		},
		realToJsex = (data, options, log) => {
			let s;
			if (data == null) {
				s = String(data);
			} else {
				let t = typeof data;
				if (t === 'boolean') {
					s = data.toString();
				} else if (t === 'string') {
					s = options.jsonCompatible ? escapeStrJson(data) : escapeStr(data);
				} else if (t === 'number') {
					s = Object.is(data, -0) ? '-0' : data.toString();
				} else if (t === 'bigint') {
					s = data + 'n';
				} else if (t === 'symbol') {
					s = Symbol.keyFor(data);
					if (typeof s === 'string') {
						s = 'Symbol.for(' + escapeStr(s) + ')';
					} else {
						if (typeof data.description === 'string') {
							s = data.description;
						} else {
							s = data.toString();
							s = s.length > 8 ? s.slice(7, s.length - 1) : '';
						}
						if (!(t = s.match(/^Symbol\.([\w$][\d\w$]*)$/)) || Symbol[t[1]] !== data) {
							s = 'Symbol(' + (s ? escapeStr(s) : '') + ')';
						}
					}
				} else if (t === 'function') {
					let v = data.toString();
					if (/\{\s*\[\w+(?: \w+)+\]\s*\}$/.test(v)) {
						if (options.debug) throw TypeError('unable to serialize native function');
					} else if (/^class(?![\d\w$])/.test(v)) {
						if (options.implicitConversion) {
							s = escapeStr(v);
						} else if (options.debug) {
							throw TypeError('class is not supported by default');
						}
					} else {
						s = functionsource(v);
						if (s === undefined && options.debug) throw TypeError('unable to serialize function');
					}
				} else {
					t = getRealType(data);
					if (t === 'RegExp') {
						s = data.toString().replace(/[\ud800-\udbff][\udc00-\udfff]|([\ud800-\udfff])/g, (p0, p1) => p1 ? '\\u' + p1.charCodeAt(0).toString(16) : p0);
					} else if (t === 'Date') {
						s = 'new Date(' + data.getTime() + ')';
					} else if (t === 'Error' && data.name !== 'AggregateError') {
						s = (['EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError'].includes(data.name) ? data.name : t) + '(';
						if (data.message) {
							s += escapeStr(data.message);
						}
						s += ')';
					} else if (log.has(data)) {
						if (options.debug) throw TypeError('circular structure detected');
					} else {
						log.add(data);
						if (t === 'Map') {
							const c = [];
							for (const n of data) {
								const v = realToJsex(n[0], options, log);
								if (v !== undefined) {
									const m = realToJsex(n[1], options, log);
									if (m !== undefined) {
										c.push('[' + v + ',' + m + ']');
									}
								}
							}
							if (options.sorting) {
								c.sort();
							}
							s = 'new Map' + (c.length ? '([' + c.join(',') + '])' : '');
						} else if (t === 'Set') {
							const c = [];
							for (const n of data) {
								const v = realToJsex(n, options, log);
								if (v !== undefined) {
									c.push(v);
								}
							}
							if (options.sorting) {
								c.sort();
							}
							s = 'new Set' + (c.length ? '([' + c.join(',') + '])' : '');
						} else if (t === 'Error') {
							if (Array.isArray(data.errors)) {
								const v = realToJsex(data.errors, options, log);
								if (v !== undefined) {
									s = 'AggregateError(' + v;
									if (data.message) {
										s += ',' + escapeStr(data.message);
									}
									s += ')';
								}
							} else if (options.debug) {
								throw TypeError('bad AggregateError');
							}
						} else if (['Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float16Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'].includes(t)) {
							s = '[';
							for (let i = 0; i < data.length; ++i) {
								if (i > 0) {
									s += ',';
								}
								const v = realToJsex(data[i], options, log);
								s += options.jsonCompatible && v === undefined ? 'null' : v;
							}
							s += ']';
							if (t !== 'Array') {
								s = 'new ' + t + '(' + s + ')';
							}
						} else if (options.implicitConversion && typeof data.valueOf === 'function' && (t = data.valueOf()) !== data) {
							s = realToJsex(t, options, log);
						} else {
							const n = Object.getOwnPropertyNames(data),
								m = Object.getOwnPropertySymbols(data);
							let i = 0;
							while (i < n.length) {
								const v = realToJsex(data[n[i]], options, log);
								if (v === undefined) {
									n.splice(i, 1);
								} else {
									n[i] = (options.jsonCompatible ? escapeStrJson(n[i]) : n[i] === '__proto__' ? '["__proto__"]' : escapeStr(n[i])) + ':' + v;
									++i;
								}
							}
							i = 0;
							while (i < m.length) {
								const v = realToJsex(data[m[i]], options, log);
								if (v === undefined) {
									m.splice(i, 1);
								} else {
									m[i] = '[' + realToJsex(m[i]) + ']:' + v;
									++i;
								}
							}
							if (options.sorting) {
								n.sort();
								m.sort();
							}
							s = '{' + n.join(',');
							if (n.length && m.length) {
								s += ',';
							}
							s += m.join(',');
							if (!options.jsonCompatible) {
								if (n.length || m.length) {
									s += ',';
								}
								s += '"__proto__":null';
							}
							s += '}';
						}
						log.delete(data);
					}
				}
			}
			return s;
		},
		parseJsexAt = (str, start, forbiddenMethods) => {
			const p = blanklength(str, start),
				i = start + p;
			let m, l, r;
			switch (str[i]) {
				case 'n':
					if (str.startsWith('new Date(', i)) {
						l = i + 9;
						m = parseJsexAt(str, l, forbiddenMethods);
						if (m && typeof m.value === 'number' && str[l += m.length] === ')') {
							r = {
								__proto__: null,
								length: l + 1 - start,
								value: new Date(m.value)
							};
						}
					} else if (str.startsWith('new Set', i)) {
						l = i + 7;
						if (str[l] === '(') {
							l += 1;
							m = parseJsexAt(str, l, forbiddenMethods);
							if (m && Array.isArray(m.value) && str[l += m.length] === ')') {
								r = {
									__proto__: null,
									length: l + 1 - start,
									value: new Set(m.value)
								};
							}
						} else {
							r = {
								__proto__: null,
								length: l - start,
								value: new Set
							};
						}
					} else if (str.startsWith('new Map', i)) {
						l = i + 7;
						if (str[l] === '(') {
							l += 1;
							m = parseJsexAt(str, l, forbiddenMethods);
							if (m && Array.isArray(m.value) && str[l += m.length] === ')') {
								for (const i of m.value) {
									if (!Array.isArray(i) || i.length !== 2) {
										m = undefined;
										break;
									}
								}
								if (m) {
									r = {
										__proto__: null,
										length: l + 1 - start,
										value: new Map(m.value)
									};
								}
							}
						} else {
							r = {
								__proto__: null,
								length: l - start,
								value: new Map
							};
						}
					} else if (m = matchAt(typedArrayRegExp, str, i)) {
						l = typedArrayRegExp.lastIndex;
						const f = parseJsexAt(str, l, forbiddenMethods);
						if (f && Array.isArray(f.value) && str[l += f.length] === ')') {
							try {
								r = {
									__proto__: null,
									length: l + 1 - start,
									value: new globalThis[m[1] + 'Array'](f.value)
								};
							} catch (e) { }
						}
					} else if (str.startsWith('null', i)) {
						l = i + 4;
						r = {
							__proto__: null,
							length: l - start,
							value: null
						};
					}
					break;
				case 'u':
					if (str.startsWith('undefined', i)) {
						l = i + 9;
						r = {
							__proto__: null,
							length: l - start,
							value: undefined
						};
					}
					break;
				case 'N':
					if (str.startsWith('NaN', i)) {
						l = i + 3;
						r = {
							__proto__: null,
							length: l - start,
							value: NaN
						};
					}
					break;
				case 't':
					if (str.startsWith('true', i)) {
						l = i + 4;
						r = {
							__proto__: null,
							length: l - start,
							value: true
						};
					}
					break;
				case 'A':
					if (str.startsWith('AggregateError(', i)) {
						l = i + 15;
						const n = parseJsexAt(str, l, forbiddenMethods);
						if (n && Array.isArray(n.value)) {
							l += n.length;
							if (str[l] === ',') {
								l += 1;
								m = parseJsexAt(str, l, forbiddenMethods);
								if (m && typeof m.value === 'string') {
									l += m.length;
									if (str[l] === ')') {
										r = {
											__proto__: null,
											length: l + 1 - start,
											value: AggregateError(n.value, m.value)
										};
									}
								}
							} else if (str[l] === ')') {
								r = {
									__proto__: null,
									length: l + 1 - start,
									value: AggregateError(n.value)
								};
							}
						}
					}
					break;
				case '[': {
					let mf,
						ml = true,
						me = true,
						mq = false,
						mn = false;
					l = i + 1;
					m = [];
					while (!(mn || me && str[l] === ']')) {
						if (mq) {
							if (str[l] === ',') {
								l += 1;
								ml = true;
								me = mq = false;
								continue;
							}
						} else if (ml) {
							mf = parseJsexAt(str, l, forbiddenMethods);
							if (mf) {
								l += mf.length;
								l = skipblank(str, l);
								m.push(mf.value);
								ml = false;
								me = mq = true;
								continue;
							}
						}
						mn = true;
					}
					if (!mn) {
						r = {
							__proto__: null,
							length: l + 1 - start,
							value: m
						};
					}
					break;
				}
				case '{': {
					let mf, mm,
						ml = true,
						me = true,
						mq = false,
						mn = false;
					l = i + 1;
					m = { __proto__: null };
					while (!(mn || me && str[l] === '}')) {
						if (mq) {
							if (str[l] === ',') {
								l += 1;
								ml = true;
								me = mq = false;
								continue;
							}
						} else if (ml) {
							mf = parseJsexAt(str, l, forbiddenMethods);
							if (mf && ((mm = typeof mf.value === 'string') || Array.isArray(mf.value) && mf.value.length === 1 && ['symbol', 'string'].includes(typeof mf.value[0]))) {
								l += mf.length;
								l = skipblank(str, l);
								mm = mm ? mf.value === '__proto__' ? null : mf.value : mf.value[0];
								if (str[l] === ':') {
									l += 1;
									mf = parseJsexAt(str, l, forbiddenMethods);
									if (mf) {
										l += mf.length;
										l = skipblank(str, l);
										if (mm !== null && (typeof mf.value !== 'function' || getRealType(forbiddenMethods) !== 'Set' || !forbiddenMethods.has(mm))) {
											m[mm] = mf.value;
										}
										ml = false;
										me = mq = true;
										continue;
									}
								}
							}
						}
						mn = true;
					}
					if (!mn) {
						r = {
							__proto__: null,
							length: l + 1 - start,
							value: m
						};
					}
					break;
				}
				case '"':
					if (m = matchAt(stringRegExp, str, i)) {
						try {
							r = {
								__proto__: null,
								length: stringRegExp.lastIndex - start,
								value: m[1].replace(/\\(?:([0-3]?[0-7]{1,2})|x([\dA-Fa-f]{2})|u(?:([\dA-Fa-f]{4})|\{((?:10|[\dA-Fa-f])?[\dA-Fa-f]{1,4})\})|(\r\n?|\n)|([^\r\n]))/g, (p0, p1, p2, p3, p4, p5, p6) => {
									if (p1) {
										return String.fromCharCode('0o' + p1);
									} else if (p2 || p3) {
										return String.fromCharCode('0x' + (p2 || p3));
									} else if (p4) {
										return String.fromCodePoint('0x' + p4);
									} else if (p5) {
										return '';
									} else if (p6 === 'b') {
										return '\b';
									} else if (p6 === 't') {
										return '\t';
									} else if (p6 === 'n') {
										return '\n';
									} else if (p6 === 'v') {
										return '\v';
									} else if (p6 === 'f') {
										return '\f';
									} else if (p6 === 'r') {
										return '\r';
									} else if ('ux'.includes(p6)) {
										throw SyntaxError('Invalid Unicode escape sequence');
									} else {
										return p6;
									}
								})
							};
						} catch (e) { }
					}
					break;
				case '/':
					if (m = matchAt(regExpRegExp, str, i)) {
						try {
							r = {
								__proto__: null,
								length: regExpRegExp.lastIndex - start,
								value: RegExp(m[1], m[2])
							};
						} catch (e) { }
					}
					break;
				case '-':
				case '0':
				case '1':
				case '2':
				case '3':
				case '4':
				case '5':
				case '6':
				case '7':
				case '8':
				case '9':
				case 'I':
					if (m = matchAt(bigintRegExp, str, i)) {
						r = {
							__proto__: null,
							length: bigintRegExp.lastIndex - start,
							value: m[1] ? -BigInt(m[2]) : BigInt(m[2])
						};
					} else if (m = matchAt(numberRegExp, str, i)) {
						r = {
							__proto__: null,
							length: numberRegExp.lastIndex - start,
							value: m[1] ? -m[2] : +m[2]
						};
					}
					break;
				default:
					if (str.startsWith('false', i)) {
						l = i + 5;
						r = {
							__proto__: null,
							length: l - start,
							value: false
						};
					} else if (str.startsWith('Symbol', i)) {
						l = i + 6;
						if (str[l] === '(') {
							l += 1;
							if (str[l] === ')') {
								r = {
									__proto__: null,
									length: l + 1 - start,
									value: Symbol()
								};
							} else {
								m = parseJsexAt(str, l, forbiddenMethods);
								if (m && typeof m.value === 'string') {
									l += m.length;
									if (str[l] === ')') {
										r = {
											__proto__: null,
											length: l + 1 - start,
											value: Symbol(m.value)
										};
									}
								}
							}
						} else if (str.startsWith('.for(', l)) {
							l += 5;
							m = parseJsexAt(str, l, forbiddenMethods);
							if (m && typeof m.value === 'string') {
								l += m.length;
								if (str[l] === ')') {
									r = {
										__proto__: null,
										length: l + 1 - start,
										value: Symbol.for(m.value)
									};
								}
							}
						} else if ((m = matchAt(symbolPropertyRegExp, str, l)) && typeof Symbol[m[1]] === 'symbol') {
							r = {
								__proto__: null,
								length: symbolPropertyRegExp.lastIndex - start,
								value: Symbol[m[1]]
							};
						}
					} else if (l = functionlength(str, i)) {
						try {
							r = {
								__proto__: null,
								length: l - start,
								value: Function('return ' + str.slice(i, l))()
							};
						} catch (e) { }
					} else if (m = matchAt(errorRegExp, str, i)) {
						l = errorRegExp.lastIndex;
						const c = globalThis[m[1]];
						if (str[l] === ')') {
							r = {
								__proto__: null,
								length: l + 1 - start,
								value: c()
							};
						} else {
							const n = parseJsexAt(str, l, forbiddenMethods);
							if (n && typeof n.value === 'string') {
								l += n.length;
								if (str[l] === ')') {
									try {
										r = {
											__proto__: null,
											length: l + 1 - start,
											value: c(n.value)
										};
									} catch (e) { }
								} else if (str[l] === ',') {
									l += 1;
									const b = parseJsexAt(str, l, forbiddenMethods);
									if (b && typeof b.value === 'string') {
										l += b.length;
										if (str[l] === ')') {
											try {
												r = {
													__proto__: null,
													length: l + 1 - start,
													value: c(n.value, b.value)
												};
											} catch (e) { }
										}
									}
								}
							}
						}
					}
					break;
			}
			return r;
		};

	// add well-known symbols to implicit methods
	for (const n of Object.getOwnPropertyNames(Symbol)) {
		const m = Symbol[n];
		if (typeof m === 'symbol' && typeof m.description === 'string' && m.description.startsWith('Symbol.')) {
			implicitMethods.add(m);
		}
	}

	// serialize to jsex
	// sorting: whether sorting keys in Map, Set and Object
	// implicitConversion: Whether trying to resolve unrecognized type by calling its valueOf method
	// jsonCompatible: whether generate JSON compatible string. this argument makes sance only if data doesn't contain extended types
	// debug: whether throw error when meet unexpected data
	globalThis.toJsex = (data, options = { __proto__: null }) => realToJsex(data, options, new Set);

	// deserialize jsex, support JSON string
	String.prototype.parseJsex = function (forbiddenMethods = implicitMethods) {
		return parseJsexAt(this, 0, forbiddenMethods);
	};
})();