// jsex version: 2.0.1
// https://github.com/xxoo/jsex
(() => {
	'use strict';
	const implicitMethods = new Set(['toString', 'toJSON', 'valueOf']),
		blanklength = str => str.match(/^(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/.*)*/)[0].length,
		isLine = c => c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029',
		isIdPart = c => /[\dA-Za-z_$]/.test(c),
		isPunct = c => c === undefined || /[\s()[\]{}"'`/\\.,;?:~!%^&*+\-=<>|]/.test(c),
		skipblank = (s, i = 0) => i + blanklength(s.slice(i)),
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
		wordlength = (s, i = 0) => {
			const m = s.slice(i).match(/^(?:[A-Za-z_$][\dA-Za-z_$]*|[^\s()[\]{}"'`/\\.,;?:~!%^&*+\-=<>|]+)/);
			return m ? m[0].length : 0;
		},
		isWord = (s, i, w) => s.slice(i, i + w.length) === w && isPunct(s[i + w.length]),
		// t is the closing character
		sectionlength = (s, t) => {
			const blockComment = i => blockcommentlength(s, i),
				lineComment = i => {
					while (i < s.length && !isLine(s[i])) ++i;
					return i;
				},
				string = i => {
					const q = s[i++];
					while (i < s.length && s[i] !== q) {
						i += s[i] === '\\' ? isLine(s[i + 1]) && s[i + 1] === '\r' && s[i + 2] === '\n' ? 3 : 2 : 1;
					}
					return i < s.length ? i + 1 : undefined;
				},
				regex = i => {
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
				number = i => i + s.slice(i).match(/^(?:0[xX][\dA-Fa-f](?:_?[\dA-Fa-f])*n?|0[bB][01](?:_?[01])*n?|0[oO][0-7](?:_?[0-7])*n?|(?:\d(?:_?\d)*)(?:\.(?:\d(?:_?\d)*)?)?(?:[eE][+-]?\d(?:_?\d)*)?n?|\.(?:\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?)/)[0].length,
				unicodeEscape = i => {
					if (s[i + 2] !== '{') return i + 6;
					i += 3;
					while (i < s.length && s[i] !== '}') ++i;
					return i < s.length ? i + 1 : undefined;
				},
				word = i => {
					const start = i;
					let escaped = false;
					if (s[i] === '\\') {
						escaped = true;
						i = unicodeEscape(i);
					} else if (/[A-Za-z_$]/.test(s[i])) {
						++i;
					} else {
						while (!isPunct(s[i])) ++i;
						return [s.slice(start, i), i, true];
					}
					while (isIdPart(s[i]) || s[i] === '\\') {
						if (s[i] === '\\') {
							escaped = true;
							i = unicodeEscape(i);
						} else {
							++i;
						}
					}
					return [s.slice(start, i), i, escaped];
				},
				template = i => {
					++i;
					while (i < s.length && s[i] !== '`') {
						if (s[i] === '\\') {
							i += 2;
						} else if (s[i] === '$' && s[i + 1] === '{') {
							i = scan(i + 2, '}');
							if (i === undefined) return;
						} else {
							++i;
						}
					}
					return i < s.length ? i + 1 : undefined;
				},
				scan = (i, end) => {
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
					const push = c => {
						stack.push(c);
						expr = true;
						statementStart = ['block', 'function', 'arrow'].includes(c.kind);
					},
						pop = () => {
							const c = stack.pop();
							if (c.kind === 'root') return true;
							if (c.kind === 'fnParams') {
								fnBody = c.after;
								expr = true;
							} else if (c.kind === 'control') {
								controlBody = true;
								expr = statementStart = true;
							} else {
								if (c.kind === 'paren' && ['object', 'class'].includes(stack[stack.length - 1].kind)) methodBody = true;
								expr = c.after;
								statementStart = c.kind === 'block';
							}
						},
						clearBody = c => {
							if (c !== '{') arrowBody = controlBody = methodBody = false;
						};
					while (i < s.length) {
						const c = s[i],
							top = stack[stack.length - 1];
						if (/\s/.test(c)) {
							++i;
						} else if (s.slice(i, i + 2) === '//') {
							i = lineComment(i + 2);
						} else if (s.slice(i, i + 2) === '/*') {
							i = blockComment(i);
							if (i === undefined) return;
						} else if (s.slice(i, i + 4) === '<!--') {
							i = lineComment(i + 4);
						} else if (c === top.close) {
							++i;
							if (pop()) return i;
						} else if (c === '"' || c === '\'') {
							clearBody(c);
							i = string(i);
							if (i === undefined) return;
							expr = statementStart = false;
							asyncStart = undefined;
						} else if (c === '`') {
							clearBody(c);
							i = template(i);
							if (i === undefined) return;
							expr = statementStart = false;
							asyncStart = undefined;
						} else if (c === '/') {
							clearBody(c);
							asyncStart = undefined;
							if (expr) {
								const n = regex(i);
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
							clearBody(c);
							push(fn ? {
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
							});
							fn = control = false;
							asyncStart = undefined;
							++i;
						} else if (c === '[') {
							clearBody(c);
							asyncStart = undefined;
							push({
								after: false,
								close: ']',
								kind: 'bracket'
							});
							++i;
						} else if (c === '{') {
							asyncStart = undefined;
							const kind = fnBody !== undefined || methodBody ? 'function' : arrowBody ? 'arrow' : classState && classState.depth === stack.length ? 'class' : controlBody || statementStart || !expr ? 'block' : 'object';
							push({
								after: kind === 'block' ? true : kind === 'function' ? fnBody : kind === 'class' ? classState.after : false,
								close: '}',
								kind
							});
							if (kind === 'class') classState = false;
							fnBody = undefined;
							arrowBody = controlBody = methodBody = false;
							++i;
						} else if (/\d/.test(c) || c === '.' && /\d/.test(s[i + 1])) {
							clearBody(c);
							i = number(i);
							expr = statementStart = false;
							asyncStart = undefined;
						} else if (/[A-Za-z_$\\]/.test(c) || !isPunct(c)) {
							const w = word(i);
							let k = w[0];
							clearBody(c);
							i = w[1];
							if (i === undefined) return;
							if (!w[2] && k === 'async') {
								asyncStart = statementStart;
								expr = statementStart = false;
							} else {
								if (!w[2] && k === 'function') {
									fn = {
										after: asyncStart !== undefined ? asyncStart : statementStart
									};
									asyncStart = undefined;
								} else if (!w[2] && k === 'class') {
									classState = {
										after: statementStart,
										depth: stack.length
									};
									asyncStart = undefined;
									expr = true;
								} else if (!w[2] && ['if', 'while', 'for', 'with', 'switch', 'catch'].includes(k)) {
									asyncStart = undefined;
									control = expr = true;
								} else if (!w[2] && ['return', 'throw', 'case', 'delete', 'void', 'typeof', 'new', 'in', 'instanceof', 'extends', 'of', 'yield', 'await', 'else', 'do'].includes(k)) {
									asyncStart = undefined;
									expr = true;
								} else {
									asyncStart = undefined;
									expr = false;
								}
								statementStart = false;
							}
						} else if (s.slice(i, i + 2) === '=>') {
							i += 2;
							arrowBody = expr = true;
							asyncStart = undefined;
						} else {
							clearBody(c);
							i += s.slice(i, i + 3) === '...' ? 3 : s.slice(i, i + 2) === '++' || s.slice(i, i + 2) === '--' ? 2 : 1;
							expr = c === '.' ? false : !')]}'.includes(c);
							statementStart = c === ';';
							asyncStart = undefined;
						}
					}
				};
			return scan(1, t);
		},
		methodnamelength = (s, i) => {
			let l;
			if (s[i] === '[') {
				return sectionlength(s.slice(i), ']');
			} else if (s[i] === '"' || s[i] === '\'') {
				l = stringlength(s, i);
				return l && l - i;
			} else {
				l = wordlength(s, i);
				if (l) return l;
				while (i + l < s.length && !/\s/.test(s[i + l]) && !'({'.includes(s[i + l])) ++l;
				return l;
			}
		},
		methodparts = (s, i) => {
			let l = methodnamelength(s, i);
			if (!l) return;
			i = skipblank(s, i + l);
			if (s[i] === '(') {
				l = sectionlength(s.slice(i), ')');
				if (!l) return;
				return [s.slice(i, i + l), i + l];
			} else if (s[i] === '{') {
				return ['()', i];
			}
		},
		functionsource = v => {
			let i = 0,
				isAsync = false,
				isGenerator = false,
				l;
			if (functionlength(v) === v.length && !isWord(v, 0, 'function') && !isWord(v, skipblank(v, isWord(v, 0, 'async') ? 5 : 0), 'function')) return v;
			if (isWord(v, 0, 'async')) {
				const n = skipblank(v, 5);
				if (n > 5) {
					isAsync = true;
					i = n;
				}
			}
			if (isWord(v, i, 'function')) {
				i = skipblank(v, i + 8);
				if (v[i] === '*') {
					isGenerator = true;
					i = skipblank(v, i + 1);
				}
				if (v[i] !== '(') {
					l = methodnamelength(v, i);
					if (!l) return;
					i = skipblank(v, i + l);
				}
				return (isAsync ? 'async ' : '') + 'function' + (isGenerator ? '*' : '') + v.slice(i);
			}
			i = skipblank(v, i);
			if (v[i] === '*') {
				isGenerator = true;
				i = skipblank(v, i + 1);
			}
			if ((isWord(v, i, 'get') || isWord(v, i, 'set')) && skipblank(v, i + 3) > i + 3) {
				i = skipblank(v, i + 3);
			}
			const p = methodparts(v, i);
			if (!p) return;
			return (isAsync ? 'async ' : '') + 'function' + (isGenerator ? '*' : '') + p[0] + v.slice(p[1]);
		},
		expressionlength = (s, i) => {
			const start = i;
			let expr = true;
			while (i < s.length) {
				const c = s[i];
				let l;
				if (',;)]}'.includes(c)) {
					return i > start ? i : undefined;
				} else if (/\s/.test(c)) {
					++i;
				} else if (s.slice(i, i + 2) === '//') {
					i = linecommentlength(s, i + 2);
				} else if (s.slice(i, i + 2) === '/*') {
					i = blockcommentlength(s, i);
					if (i === undefined) return;
				} else if (c === '"' || c === '\'') {
					i = stringlength(s, i);
					if (i === undefined) return;
					expr = false;
				} else if (c === '`') {
					l = sectionlength(s.slice(i), '`');
					if (!l) return;
					i += l;
					expr = false;
				} else if (c === '(') {
					l = sectionlength(s.slice(i), ')');
					if (!l) return;
					i += l;
					expr = false;
				} else if (c === '[') {
					l = sectionlength(s.slice(i), ']');
					if (!l) return;
					i += l;
					expr = false;
				} else if (c === '{') {
					l = sectionlength(s.slice(i), '}');
					if (!l) return;
					i += l;
					expr = false;
				} else if (c === '/') {
					if (expr && (l = regexlength(s, i))) {
						i = l;
						expr = false;
					} else {
						++i;
						expr = true;
					}
				} else if (/[A-Za-z_$]/.test(c) || !isPunct(c)) {
					i += wordlength(s, i) || 1;
					expr = false;
				} else {
					i += s.slice(i, i + 3) === '...' ? 3 : s.slice(i, i + 2) === '++' || s.slice(i, i + 2) === '--' ? 2 : 1;
					expr = c === '.' ? false : !')]}'.includes(c);
				}
			}
			return i > start ? i : undefined;
		},
		arrowlength = s => {
			const body = i => {
				i = skipblank(s, i);
				if (s[i] === '{') {
					const l = sectionlength(s.slice(i), '}');
					return l && i + l;
				}
				return expressionlength(s, i);
			},
				afterparams = i => {
					i = skipblank(s, i);
					return s.slice(i, i + 2) === '=>' ? body(i + 2) : undefined;
				};
			let i, l;
			if (isWord(s, 0, 'async')) {
				i = skipblank(s, 5);
				if (i > 5 || s[i] === '(') {
					if (s[i] === '(') {
						l = sectionlength(s.slice(i), ')');
						if (l && (l = afterparams(i + l))) return l;
					} else if (l = wordlength(s, i)) {
						l = afterparams(i + l);
						if (l) return l;
					}
				}
			}
			if (s[0] === '(') {
				l = sectionlength(s, ')');
				return l && afterparams(l);
			} else if (l = wordlength(s)) {
				return afterparams(l);
			}
		},
		functionlength = s => {
			let i = 0,
				l;
			l = arrowlength(s);
			if (l) return l;
			if (isWord(s, 0, 'async')) {
				i = skipblank(s, 5);
				if (i === 5) return;
			}
			if (!isWord(s, i, 'function')) return;
			i = skipblank(s, i + 8);
			if (s[i] === '*') {
				i = skipblank(s, i + 1);
			}
			if (s[i] !== '(') {
				l = methodnamelength(s, i);
				if (!l) return;
				i = skipblank(s, i + l);
			}
			if (s[i] !== '(' || !(l = sectionlength(s.slice(i), ')'))) return;
			i = skipblank(s, i + l);
			if (s[i] !== '{' || !(l = sectionlength(s.slice(i), '}'))) return;
			return i + l;
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
						if ('description' in Symbol.prototype) {
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
		};

	// serialize to jsex
	// sorting: whether sorting keys in Map, Set and Object
	// implicitConversion: Whether trying to resolve unrecognized type by calling its valueOf method
	// jsonCompatible: whether generate JSON compatible string. this argument makes sance only if data doesn't contain extended types
	// debug: whether throw error when meet unexpected data
	globalThis.toJsex = (data, options = { __proto__: null }) => realToJsex(data, options, new Set);

	// add well-known symbols to implicit methods
	for (const n of Object.getOwnPropertyNames(Symbol)) {
		const m = Symbol[n];
		if (typeof m === 'symbol' && typeof m.description === 'string' && m.description.startsWith('Symbol.')) {
			implicitMethods.add(m);
		}
	}

	// deserialize jsex, support JSON string
	String.prototype.parseJsex = function (forbiddenMethods = implicitMethods) {
		const p = blanklength(this),
			str = this.slice(p);
		let m, l, r;
		if (str.slice(0, l = 4) === 'null') {
			r = {
				__proto__: null,
				length: l + p,
				value: null
			};
		} else if (str.slice(0, l = 9) === 'undefined') {
			r = {
				__proto__: null,
				length: l + p,
				value: undefined
			};
		} else if (str.slice(0, l = 3) === 'NaN') {
			r = {
				__proto__: null,
				length: l + p,
				value: NaN
			};
		} else if (str.slice(0, l = 4) === 'true') {
			r = {
				__proto__: null,
				length: l + p,
				value: true
			};
		} else if (str.slice(0, l = 5) === 'false') {
			r = {
				__proto__: null,
				length: l + p,
				value: false
			};
		} else if (str.slice(0, l = 9) === 'new Date(') {
			m = str.slice(l).parseJsex(forbiddenMethods);
			if (m && typeof m.value === 'number' && str[l += m.length] === ')') {
				r = {
					__proto__: null,
					length: l + p + 1,
					value: new Date(m.value)
				};
			}
		} else if (str.slice(0, l = 15) === 'AggregateError(') {
			const n = str.slice(l).parseJsex(forbiddenMethods);
			if (n && Array.isArray(n.value)) {
				l += n.length;
				if (str[l] === ',') {
					l += 1;
					m = str.slice(l).parseJsex(forbiddenMethods);
					if (m && typeof m.value === 'string') {
						l += m.length;
						if (str[l] === ')') {
							r = {
								__proto__: null,
								length: l + p + 1,
								value: AggregateError(n.value, m.value)
							};
						}
					}
				} else if (str[l] === ')') {
					r = {
						__proto__: null,
						length: l + p + 1,
						value: AggregateError(n.value)
					};
				}
			}
		} else if (str.slice(0, l = 7) === 'new Set') {
			if (str[l] === '(') {
				l += 1;
				m = str.slice(l).parseJsex(forbiddenMethods);
				if (m && Array.isArray(m.value) && str[l += m.length] === ')') {
					r = {
						__proto__: null,
						length: l + p + 1,
						value: new Set(m.value)
					};
				}
			} else {
				r = {
					__proto__: null,
					length: l + p,
					value: new Set
				};
			}
		} else if (str.slice(0, l = 7) === 'new Map') {
			if (str[l] === '(') {
				l += 1;
				m = str.slice(l).parseJsex(forbiddenMethods);
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
							length: l + p + 1,
							value: new Map(m.value)
						};
					}
				}
			} else {
				r = {
					__proto__: null,
					length: l + p,
					value: new Map
				};
			}
		} else if (str.slice(0, l = 6) === 'Symbol') {
			if (str[l] === '(') {
				l += 1;
				if (str[l] === ')') {
					r = {
						__proto__: null,
						length: l + p + 1,
						value: Symbol()
					};
				} else {
					m = str.slice(l).parseJsex(forbiddenMethods);
					if (m && typeof m.value === 'string') {
						l += m.length;
						if (str[l] === ')') {
							r = {
								__proto__: null,
								length: l + p + 1,
								value: Symbol(m.value)
							};
						}
					}
				}
			} else if (str.slice(l, l + 5) === '.for(') {
				l += 5;
				m = str.slice(l).parseJsex(forbiddenMethods);
				if (m && typeof m.value === 'string') {
					l += m.length;
					if (str[l] === ')') {
						r = {
							__proto__: null,
							length: l + p + 1,
							value: Symbol.for(m.value)
						};
					}
				}
			} else if ((m = str.slice(l).match(/^\.([\w$][\d\w$]*)/)) && typeof Symbol[m[1]] === 'symbol') {
				r = {
					__proto__: null,
					length: l + p + m[0].length,
					value: Symbol[m[1]]
				};
			}
		} else if (str[0] === '[') {
			let mf,
				ml = true,
				me = true,
				mq = false,
				mn = false;
			l = 1;
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
					mf = str.slice(l).parseJsex(forbiddenMethods);
					if (mf) {
						l += mf.length;
						l += blanklength(str.slice(l));
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
					length: l + p + 1,
					value: m
				};
			}
		} else if (str[0] === '{') {
			let mf, mm,
				ml = true,
				me = true,
				mq = false,
				mn = false;
			l = 1;
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
					mf = str.slice(l).parseJsex(forbiddenMethods);
					if (mf && ((mm = typeof mf.value === 'string') || Array.isArray(mf.value) && mf.value.length === 1 && ['symbol', 'string'].includes(typeof mf.value[0]))) {
						l += mf.length;
						l += blanklength(str.slice(l));
						mm = mm ? mf.value === '__proto__' ? null : mf.value : mf.value[0];
						if (str[l] === ':') {
							l += 1;
							mf = str.slice(l).parseJsex(forbiddenMethods);
							if (mf) {
								l += mf.length;
								l += blanklength(str.slice(l));
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
					length: l + p + 1,
					value: m
				};
			}
		} else if (l = functionlength(str)) {
			try {
				r = {
					__proto__: null,
					length: l + p,
					value: Function('return ' + str.slice(0, l))()
				};
			} catch (e) { }
		} else if (m = str.match(/^(-?)([1-9]\d*|0(?:[bB][01]+|[oO][0-7]+|[xX][\dA-Fa-f]+)?)n/)) {
			r = {
				__proto__: null,
				length: m[0].length + p,
				value: m[1] ? -BigInt(m[2]) : BigInt(m[2])
			};
		} else if (m = str.match(/^(-?)(Infinity|0(?:[bB][01]+|[oO][0-7]+|[xX][\dA-Fa-f]+)|[1-9](?:\.\d+)?[eE][-+]?[1-9]\d*|(?:[1-9]\d*|0)(?:\.\d+)?)/)) {
			r = {
				__proto__: null,
				length: m[0].length + p,
				value: m[1] ? -m[2] : +m[2]
			};
		} else if (m = str.match(/^"((?:[^\r\n"\\]|\\(?:\r\n?|[^\r]))*)"/)) {
			try {
				r = {
					__proto__: null,
					length: m[0].length + p,
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
		} else if (m = str.match(/^\/(?!\*)((?:[^[/\\\r\n\u2028\u2029]|\\.|\[(?:[^\r\n\u2028\u2029\]\\]|\\.)*\])+)\/(d?g?i?m?s?u?y?)/)) {
			try {
				r = {
					__proto__: null,
					length: m[0].length + p,
					value: RegExp(m[1], m[2])
				};
			} catch (e) { }
		} else if (m = str.match(/^new (Int8|Uint8|Uint8Clamped|Int16|Uint16|Int32|Uint32|Float16|Float32|Float64|BigInt64|BigUint64)Array\(/)) {
			l = m[0].length;
			const f = str.slice(l).parseJsex(forbiddenMethods);
			if (f && Array.isArray(f.value) && str[l += f.length] === ')') {
				try {
					r = {
						__proto__: null,
						length: l + p + 1,
						value: new globalThis[m[1] + 'Array'](f.value)
					};
				} catch (e) { }
			}
		} else if (m = str.match(/^((?:Eval|Range|Reference|Syntax|Type|URI)?Error)\(/)) {
			l = m[0].length;
			const c = globalThis[m[1]];
			if (str[l] === ')') {
				r = {
					__proto__: null,
					length: l + p + 1,
					value: c()
				};
			} else {
				const n = str.slice(l).parseJsex(forbiddenMethods);
				if (n && typeof n.value === 'string') {
					l += n.length;
					if (str[l] === ')') {
						try {
							r = {
								__proto__: null,
								length: l + p + 1,
								value: c(n.value)
							};
						} catch (e) { }
					} else if (str[l] === ',') {
						l += 1;
						const b = str.slice(l).parseJsex(forbiddenMethods);
						if (b && typeof b.value === 'string') {
							l += b.length;
							if (str[l] === ')') {
								try {
									r = {
										__proto__: null,
										length: l + p + 1,
										value: c(n.value, b.value)
									};
								} catch (e) { }
							}
						}
					}
				}
			}
		}
		return r;
	};
})();