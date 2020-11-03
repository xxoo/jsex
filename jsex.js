//jsex version: 1.0.11
//https://github.com/xxoo/jsex
(() => {
	'use strict';
	const blanklength = str => str.match(/^(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/.*)*/)[0].length,
		//assume a function has no syntax error, then we can use some ugly detection to seek out the end of its params
		paramlength = (s, infor) => {
			let e, isfor,
				i = blanklength(s.substring(1)) + 1;
			while (s[i] !== ')') {
				if (s[i] === '/') {
					if (e) {
						i++;
						e = false;
					} else {
						i += s.substring(i).match(/^\/(?!\*)(?:[^[/\\\r\n\u2028\u2029]|\\.|\[(?:[^\r\n\u2028\u2029\]\\]|\\.)*\])+\//)[0].length;
						e = true;
					}
				} else if (s[i] === '"') {
					i += s.substring(i).match(/^"(?:[^\r\n"\\]|\\(?:\r\n?|[^\r]))*"/)[0].length;
					e = true;
				} else if (s[i] === '\'') {
					i += s.substring(i).match(/^'(?:[^\r\n'\\]|\\(?:\r\n?|[^\r]))*'/)[0].length;
					e = true;
				} else if (s[i] === '`') {
					i += s.substring(i).match(/^`(?:[^`\\]|\\[\s\S])*`/)[0].length;
					e = true;
				} else if (s[i] === '(') {
					i += paramlength(s.substring(i), isfor);
					e = true;
				} else {
					let m = s.substring(i).match(/^[\d\w$.]+|[!~+\-*=<>|&{}[\]?:,;]+/);
					isfor = m[0] === 'for' || isfor && m[0] === 'await';
					i += m[0].length;
					e = infor && m[0] === 'of' ? false : ['extends', 'yield', 'await', 'new', 'delete', 'void', 'typeof', 'case', 'throw', 'return', 'in', 'else', 'do'].indexOf(m[0]) < 0 && '!~+-*=<>|&{}[?:,;'.indexOf(s[i - 1]) < 0;
				}
				i += blanklength(s.substring(i));
			}
			return i + 1;
		},
		strEncode = (str, jsonCompatible) => {
			return '"' + str.replace(jsonCompatible ? /[\ud800-\udbff][\udc00-\udfff]|[\\"\x00-\x1f\ud800-\udfff]/g : /[\ud800-\udbff][\udc00-\udfff]|[\r\n\\"\ud800-\udfff]/g, a => {
				if (a.length === 1) {
					if (a === '\\') {
						return '\\\\';
					} else if (a === '"') {
						return '\\"';
					} else if (a === '\b') {
						return '\\b';
					} else if (a === '\t') {
						return '\\t';
					} else if (a === '\n') {
						return '\\n';
					} else if (a === '\f') {
						return '\\f';
					} else if (a === '\r') {
						return '\\r';
					} else {
						let c = a.charCodeAt(0);
						return '\\u' + (c < 16 ? '000' : c < 256 ? '00' : c < 4096 ? '0' : '') + c.toString(16);
					}
				} else {
					return a;
				}
			}) + '"';
		},
		getRealType = data => {
			let t = Object.prototype.toString.call(data);
			return t.substring(8, t.length - 1);
		},
		realToJsex = (data, log, sorting, jsonCompatible, debug) => {
			let s;
			if (data == null) {
				s = String(data);
			} else {
				let t = typeof data;
				if (t === 'boolean') {
					s = data.toString();
				} else if (t === 'string') {
					s = strEncode(data, jsonCompatible);
				} else if (t === 'number') {
					s = Object.is(data, -0) ? '-0' : data.toString();
				} else if (t === 'bigint') {
					s = data + 'n';
				} else if (t === 'symbol') {
					s = Symbol.keyFor(data);
					if (typeof s === 'string') {
						s = 'Symbol.for(' + strEncode(s) + ')';
					} else {
						if ('description' in Symbol.prototype) {
							s = data.description;
						} else {
							s = data.toString();
							s = s.length > 8 ? s.substring(7, s.length - 1) : '';
						}
						if (!(t = s.match(/^Symbol\.([\w$][\d\w$]*)$/)) || Symbol[t[1]] !== data) {
							s = 'Symbol(' + (s ? strEncode(s) : '') + ')';
						}
					}
				} else if (t === 'function') {
					let v = data.toString();
					if (/^class(?![\d\w$])/.test(v)) {
						if (debug) throw TypeError('unable to serialize class');
					} else if (/\{\s*\[\w+(?: \w+)+\]\s*\}$/.test(v)) {
						if (debug) throw TypeError('unable to serialize native function');
					} else {
						//these constructors are not global by default
						const c = {
							AsyncFunction: '(async()=>{}).constructor',
							GeneratorFunction: 'function*(){}.constructor',
							AsyncGeneratorFunction: 'async function*(){}.constructor'
						};
						t = getRealType(data);
						if (t[0] === 'A') {
							v = v.replace(/^async(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/.*)*/, '');
						}
						v = v.replace(/^(?:function(?![\d\w$])(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/.*)*)?(?:\*(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/.*)*)?(?:[\w$][\d\w$]*(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/.*)*(?=\())?/, '');
						if (v[0] === '(') {
							let l = paramlength(v);
							s = v.substring(0, l).replace(/^\(\s*|\s*\)$/g, '');
							v = v.substring(l);
						} else {
							s = v.match(/^[\w$][\d\w$]*/)[0];
							v = v.substring(s.length);
						}
						v = v.substring(blanklength(v)).replace(/^=>(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/.*)*/, '');
						v = v[0] === '{' ? v.replace(/^\{\s*|\s*\}$/g, '') : 'return ' + v;
						s = (t in c ? c[t] : 'Function') + (v ? `(${s ? strEncode(s) + ',' : ''}${strEncode(v)})` : '()');
					}
				} else {
					t = getRealType(data);
					if (t === 'RegExp') {
						s = data.toString();
					} else if (t === 'Date') {
						s = 'new Date(' + data.getTime() + ')';
					} else if (t === 'Error' && data.name !== 'AggregateError') {
						s = (['EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError'].indexOf(data.name) < 0 ? t : data.name) + '(';
						if (data.message) {
							s += strEncode(data.message);
						}
						s += ')';
					} else if (log.has(data)) {
						if (debug) throw TypeError('circular structure detected');
					} else {
						log.add(data);
						if (t === 'Map') {
							let c = [];
							for (let n of data) {
								let v = realToJsex(n[0], log, sorting, jsonCompatible, debug);
								if (v !== undefined) {
									let m = realToJsex(n[1], log, sorting, jsonCompatible, debug);
									if (m !== undefined) {
										c.push('[' + v + ',' + m + ']');
									}
								}
							}
							s = 'new Map' + (c.length ? '([' + c.join(',') + '])' : '');
						} else if (t === 'Set') {
							let c = [];
							for (let n of data) {
								let v = realToJsex(n, log, sorting, jsonCompatible, debug);
								if (v !== undefined) {
									c.push(v);
								}
							}
							if (sorting) {
								c.sort();
							}
							s = 'new Set' + (c.length ? '([' + c.join(',') + '])' : '');
						} else if (t === 'Error') {
							if (Array.isArray(data.errors)) {
								let v = realToJsex(data.errors, log, sorting, jsonCompatible, debug);
								if (v !== undefined) {
									s = 'AggregateError(' + v;
									if (data.message) {
										s += ',' + strEncode(data.message);
									}
									s += ')';
								}
							} else if (debug) {
								throw TypeError('bad AggregateError');
							}
						} else if (['Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'].indexOf(t) >= 0) {
							let c = [];
							for (let i = 0; i < data.length; i++) {
								let v = realToJsex(data[i], log, sorting, jsonCompatible, debug);
								if (v !== undefined) {
									c.push(v);
								}
							}
							s = '[' + c.join(',') + ']';
						} else if (typeof data.valueOf === 'function' && data !== (t = data.valueOf())) {
							s = realToJsex(t, log, sorting, jsonCompatible, debug);
						} else {
							let c = [],
								n = Object.getOwnPropertyNames(data),
								m = Object.getOwnPropertySymbols(data);
							if (!jsonCompatible) {
								c.push('"__proto__":null');
							}
							for (let i = 0; i < n.length; i++) {
								let v = realToJsex(data[n[i]], log, sorting, jsonCompatible, debug);
								if (v !== undefined) {
									c.push((!jsonCompatible && n[i] === '__proto__' ? '["__proto__"]' : strEncode(n[i], jsonCompatible)) + ':' + v);
								}
							}
							n = [];
							for (let i = 0; i < m.length; i++) {
								let v = realToJsex(data[m[i]], log, sorting, jsonCompatible, debug);
								if (v !== undefined) {
									n.push('[' + realToJsex(m[i]) + ']:' + v);
								}
							}
							if (sorting) {
								c.sort();
								n.sort();
							}
							s = '{' + c.join(',') + (c.length && n.length ? ',' : '') + n.join(',') + '}';
						}
						log.delete(data);
					}
				}
			}
			return s;
		};

	//we want globalThis
	if (typeof globalThis === 'undefined') {
		self.globalThis = self;
	}

	//serialize to jsex
	//sorting: whether sorting keys in Map, Set and Object
	//jsonCompatible: whether generate JSON compatible string. this argument makes sance only if data doesn't contain extended types
	//debug: whether throw error when meet unexpected data
	globalThis.toJsex = (data, options = {}) => realToJsex(data, new Set(), options.sorting, options.jsonCompatible, options.debug);

	//deserialize jsex, support JSON string
	String.prototype.parseJsex = function () {
		let m, l, r,
			p = blanklength(this),
			str = this.substring(p);
		if (str.substring(0, l = 4) === 'null') {
			r = {
				value: null,
				length: l + p
			};
		} else if (str.substring(0, l = 9) === 'undefined') {
			r = {
				value: undefined,
				length: l + p
			};
		} else if (str.substring(0, l = 3) === 'NaN') {
			r = {
				value: NaN,
				length: l + p
			};
		} else if (str.substring(0, l = 4) === 'true') {
			r = {
				value: true,
				length: l + p
			};
		} else if (str.substring(0, l = 5) === 'false') {
			r = {
				value: false,
				length: l + p
			};
		} else if (str.substring(0, l = 9) === 'new Date(') {
			m = str.substring(l).parseJsex();
			if (m && typeof m.value === 'number' && str[l += m.length] === ')') {
				r = {
					value: new Date(m.value),
					length: l + p + 1
				};
			}
		} else if (str.substring(0, l = 15) === 'AggregateError(') {
			let n = str.substring(l).parseJsex();
			if (n && Array.isArray(n.value)) {
				l += n.length;
				if (str[l] === ',') {
					l += 1;
					let m = str.substring(l).parseJsex();
					if (m && typeof m.value === 'string') {
						l += m.length;
						if (str[l] === ')') {
							r = {
								value: AggregateError(n.value, m.value),
								length: l + p + 1
							};
						}
					}
				} else if (str[l] === ')') {
					r = {
						value: AggregateError(n.value),
						length: l + p + 1
					};
				}
			}
		} else if (str.substring(0, l = 7) === 'new Set') {
			if (str[l] === '(') {
				l += 1;
				m = str.substring(l).parseJsex();
				if (m && Array.isArray(m.value) && str[l += m.length] === ')') {
					r = {
						value: new Set(m.value),
						length: l + p + 1
					};
				}
			} else {
				r = {
					value: new Set,
					length: l + p
				};
			}
		} else if (str.substring(0, l = 7) === 'new Map') {
			if (str[l] === '(') {
				l += 1;
				m = str.substring(l).parseJsex();
				if (m && Array.isArray(m.value) && str[l += m.length] === ')') {
					for (let i = 0; i < m.value.length; i++) {
						if (!Array.isArray(m.value[i]) || m.value[i].length !== 2) {
							m.e = true;
							break;
						}
					}
					if (!m.e) {
						r = {
							value: new Map(m.value),
							length: l + p + 1
						};
					}
				}
			} else {
				r = {
					value: new Map,
					length: l + p
				};
			}
		} else if (str.substring(0, l = 6) === 'Symbol') {
			if (str[l] === '(') {
				l += 1;
				if (str[l] === ')') {
					r = {
						value: Symbol(),
						length: l + p + 1
					};
				} else {
					m = str.substring(l).parseJsex();
					if (m && typeof m.value === 'string') {
						l += m.length;
						if (str[l] === ')') {
							r = {
								value: Symbol(m.value),
								length: l + p + 1
							};
						}
					}
				}
			} else if (str.substring(l, l + 5) === '.for(') {
				l += 5;
				m = str.substring(l).parseJsex();
				if (m && typeof m.value === 'string') {
					l += m.length;
					if (str[l] === ')') {
						r = {
							value: Symbol.for(m.value),
							length: l + p + 1
						};
					}
				}
			} else if ((m = str.substring(l).match(/^\.([\w$][\d\w$]*)/)) && typeof Symbol[m[1]] === 'symbol') {
				r = {
					value: Symbol[m[1]],
					length: l + p + m[0].length
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
			while (!(mn || (me && str[l] === ']'))) {
				if (mq) {
					if (str[l] === ',') {
						l += 1;
						ml = true;
						me = mq = false;
						continue;
					}
				} else if (ml) {
					mf = str.substring(l).parseJsex();
					if (mf) {
						l += mf.length;
						l += blanklength(str.substring(l));
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
					value: m,
					length: l + p + 1
				};
			}
		} else if (str[0] === '{') {
			let mf, mm,
				ml = true,
				me = true,
				mq = false,
				mn = false;
			l = 1;
			m = Object.create(null);
			while (!(mn || (me && str[l] === '}'))) {
				if (mq) {
					if (str[l] === ',') {
						l += 1;
						ml = true;
						me = mq = false;
						continue;
					}
				} else if (ml) {
					mf = str.substring(l).parseJsex();
					if (mf && (mm = typeof mf.value === 'string') || (Array.isArray(mf.value) && mf.value.length === 1 && ['symbol', 'string'].indexOf(typeof mf.value[0]) >= 0)) {
						l += mf.length;
						l += blanklength(str.substring(l));
						mm = mm ? mf.value === '__proto__' ? null : mf.value : mf.value[0];
						if (str[l] === ':') {
							l += 1;
							mf = str.substring(l).parseJsex();
							if (mf) {
								l += mf.length;
								l += blanklength(str.substring(l));
								if (mm !== null) {
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
					value: m,
					length: l + p + 1
				};
			}
		} else if (m = str.match(/^(-?)([1-9]\d*|0(?:[bB][01]+|[oO][0-7]+|[xX][\dA-Fa-f]+)?)n/)) {
			r = {
				value: m[1] ? -BigInt(m[2]) : BigInt(m[2]),
				length: m[0].length + p
			};
		} else if (m = str.match(/^(-?)(Infinity|0(?:[bB][01]+|[oO][0-7]+|[xX][\dA-Fa-f]+)|[1-9](?:\.\d+)?[eE][-+]?[1-9]\d*|(?:[1-9]\d*|0)(?:\.\d+)?)/)) {
			r = {
				value: m[1] ? -m[2] : +m[2],
				length: m[0].length + p
			};
		} else if (m = str.match(/^"((?:[^\r\n"\\]|\\(?:\r\n?|[^\r]))*)"/)) {
			try {
				r = {
					value: m[1].replace(/\\(?:([0-7]{1,2})|x([\dA-Fa-f]{2})|u(?:([\dA-Fa-f]{4})|\{([\dA-Fa-f]{1,5})\})|(\r\n?|\n)|([^\r\n]))/g, (p0, p1, p2, p3, p4, p5, p6) => {
						if (p1) {
							return String.fromCharCode('0o' + p1);
						} else if (p2 || p3) {
							return String.fromCharCode('0x' + (p2 | p3));
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
						} else if ('ux'.indexOf(p6) < 0) {
							return p6;
						} else {
							throw SyntaxError('Invalid Unicode escape sequence');
						}
					}),
					length: m[0].length + p
				};
			} catch (e) { }
		} else if (m = str.match(/^\/(?!\*)((?:[^[/\\\r\n\u2028\u2029]|\\.|\[(?:[^\r\n\u2028\u2029\]\\]|\\.)*\])+)\/(g?i?m?s?u?y?)/)) {
			try {
				r = {
					value: RegExp(m[1], m[2]),
					length: m[0].length + p
				};
			} catch (e) { }
		} else if (m = str.match(/^(?:((?:Eval|Range|Reference|Syntax|Type|URI)?Error|Function)|(?:(\(async ?\( ?\) ?=> ?\{ ?\}\))|(async )?function\* ?\( ?\) ?\{ ?\})\.constructor)\(/)) {
			l = m[0].length;
			let c = m[1] ? globalThis[m[1]] : m[2] ? (async () => { }).constructor : m[3] ? async function* () { }.constructor : function* () { }.constructor;
			if (str[l] === ')') {
				r = {
					value: c(),
					length: l + p + 1
				};
			} else {
				let n = str.substring(l).parseJsex();
				if (n && typeof n.value === 'string') {
					l += n.length;
					if (str[l] === ')') {
						r = {
							value: c(n.value),
							length: l + p + 1
						};
					} else if (str[l] === ',') {
						l += 1;
						let b = str.substring(l).parseJsex();
						if (b && typeof b.value === 'string') {
							l += b.length;
							if (str[l] === ')') {
								r = {
									value: c(n.value, b.value),
									length: l + p + 1
								};
							}
						}
					}
				}
			}
		}
		return r;
	};
})();