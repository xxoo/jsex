//jsex version: 1.0.3
//https://github.com/xxoo/jsex
(() => {
	'use strict';
	const arrays = ['Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'],
		//assume a function has no syntax error, then we can use some ugly detection to seek out the end of its params
		paramlength = (s, infor) => {
			let e, isfor,
				i = 1;
			while (s[i] !== ')') {
				let n = blanklength(s.substring(i));
				if (n > 0) {
					i += n;
				} else if (s[i] === '/') {
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
					let m = s.substring(i).match(/^[\d\w$.]+|[!~+\-*=<>|&{}\[\]?:,;]+/);
					isfor = m[0] === 'for' || isfor && m[0] === 'await';
					i += m[0].length;
					e = infor && m[0] === 'of' ? false : ['extends', 'yield', 'await', 'new', 'delete', 'void', 'typeof', 'case', 'throw', 'return', 'in', 'else', 'do'].indexOf(m[0]) < 0 && '!~+-*=<>|&{}[?:,;'.indexOf(s[i - 1]) < 0;
				}
			}
			return i + 1;
		},
		blanklength = str => {
			let m = str.match(/^(?:\s?(?:\/\*(?:[^*]|\*(?!\/))*\*\/)?(?:\/\/.*)?)*/);
			return m ? m[0].length : 0;
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
		realToJsex = (d, log, sorting, jsonCompatible, dbg) => {
			let s;
			if (d == null) {
				s = String(d);
			} else {
				let t = dataType(d);
				if (t === 'boolean' || t === 'RegExp') {
					s = d.toString();
				} else if (t === 'string') {
					s = strEncode(d, jsonCompatible);
				} else if (t === 'number') {
					s = Object.is(d, -0) ? '-0' : d.toString();
				} else if (t === 'bigint') {
					s = d + 'n';
				} else if (t === 'symbol') {
					s = Symbol.keyFor(d);
					if (typeof s === 'string') {
						s = 'Symbol.for(' + strEncode(s) + ')';
					} else {
						if ('description' in Symbol.prototype) {
							s = d.description;
						} else {
							s = d.toString();
							s = s.length > 8 ? s.substring(7, s.length - 1) : '';
						}
						if (!(t = s.match(/^Symbol\.([\w$][\d\w$]*)$/)) || Symbol[t[1]] !== d) {
							s = s ? 'Symbol(' + strEncode(s) + ')' : 'Symbol()';
						}
					}
				} else if (t === 'Date') {
					s = 'new Date(' + d.getTime() + ')';
				} else if (t === 'Error' && d.name !== 'AggregateError') {
					s = (['EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError'].indexOf(d.name) < 0 ? 'Error' : d.name) + '(';
					if (d.message) {
						s += strEncode(d.message);
					}
					s += ')';
				} else if (['Function', 'AsyncFunction', 'GeneratorFunction', 'AsyncGeneratorFunction'].indexOf(t) >= 0) {
					let v = d.toString();
					if (/^class(?:\s?(?:\/\*(?:[^*]|\*(?!\/))*\*\/)?(?:\/\/.*)?)+/.test(v)) {
						if (dbg) {
							throw TypeError('unable to serialize class');
						}
					} else if (/\{\s*\[\w+(?: \w+)+\]\s*\}$/.test(v)) {
						if (dbg) {
							throw TypeError('unable to serialize native function');
						}
					} else {
						const r = /^[{(]\s*|\s*[)}]$/g,
							getparam = () => {
								let l = paramlength(v);
								p = v.substring(0, l).replace(r, '');
								v = v.substring(l);
								v = v.substring(blanklength(v));
							};
						let p;
						if (t === 'GeneratorFunction') {
							v = v.substring(8).replace(/^(?:\s?(?:\/\*(?:[^*]|\*(?!\/))*\*\/)?(?:\/\/.*)?)*\*(?:\s?(?:\/\*(?:[^*]|\*(?!\/))*\*\/)?(?:\/\/.*)?)*(?:[\w$][\d\w$]*)?(?:\s?(?:\/\*(?:[^*]|\*(?!\/))*\*\/)?(?:\/\/.*)?)*/, '');
							getparam();
						} else if (t === 'AsyncGeneratorFunction') {
							v = v.substring(5).replace(/^(?:\s?(?:\/\*(?:[^*]|\*(?!\/))*\*\/)?(?:\/\/.*)?)+function(?:\s?(?:\/\*(?:[^*]|\*(?!\/))*\*\/)?(?:\/\/.*)?)*\*(?:\s?(?:\/\*(?:[^*]|\*(?!\/))*\*\/)?(?:\/\/.*)?)*(?:[\w$][\d\w$]*)?(?:\s?(?:\/\*(?:[^*]|\*(?!\/))*\*\/)?(?:\/\/.*)?)*/, '');
							getparam();
						} else {
							if (t === 'AsyncFunction') {
								v = v.substring(5);
								v = v.substring(blanklength(v));
							}
							if (v.substring(0, 8) === 'function') {
								v = v.substring(8).replace(/^(?:\s?(?:\/\*(?:[^*]|\*(?!\/))*\*\/)?(?:\/\/.*)?)*(?:[\w$][\d\w$]*)?(?:\s?(?:\/\*(?:[^*]|\*(?!\/))*\*\/)?(?:\/\/.*)?)*/, '');
								getparam();
							} else {
								if (v[0] === '(') {
									getparam();
								} else {
									p = v.match(/^([\w$][\d\w$]*)/)[0];
									v = v.substring(p.length);
									v = v.substring(blanklength(v));
								}
								v = v.substring(2);
								v = v.substring(blanklength(v));
							}
						}
						if (v[0] === '{') {
							v = v.replace(r, '');
						} else {
							v = 'return ' + v;
						}
						s = t + (v ? `(${p ? strEncode(p) + ',' : ''}${strEncode(v)})` : '()');
					}
				} else if (log.has(d)) {
					if (dbg) {
						throw TypeError('circular structure detected');
					}
				} else {
					log.add(d);
					if (arrays.indexOf(t) >= 0) {
						let c = [];
						for (let i = 0; i < d.length; i++) {
							let v = realToJsex(d[i], log, sorting, jsonCompatible, dbg);
							if (v !== undefined) {
								c.push(v);
							}
						}
						s = '[' + c.join(',') + ']';
					} else if (t === 'Map') {
						let c = [];
						for (let n of d) {
							let v = realToJsex(n[0], log, sorting, jsonCompatible, dbg);
							if (v !== undefined) {
								let m = realToJsex(n[1], log, sorting, jsonCompatible, dbg);
								if (m !== undefined) {
									c.push('[' + v + ',' + m + ']');
								}
							}
						}
						s = 'new Map' + (c.length ? '([' + c.join(',') + '])' : '');
					} else if (t === 'Set') {
						let c = [];
						for (let n of d) {
							let v = realToJsex(n, log, sorting, jsonCompatible, dbg);
							if (v !== undefined) {
								c.push(v);
							}
						}
						if (sorting) {
							c.sort();
						}
						s = 'new Set' + (c.length ? '([' + c.join(',') + '])' : '');
					} else if (t === 'Error') {
						if (Array.isArray(d.errors)) {
							let v = realToJsex(d.errors, log, sorting, jsonCompatible, dbg);
							if (v !== undefined) {
								s = 'AggregateError(' + v + '';
								if (d.message) {
									s += ',' + strEncode(d.message);
								}
								s += ')';
							}
						} else if (dbg) {
							throw TypeError('bad AggregateError');
						}
					} else if (typeof d.valueOf === 'function' && d !== (t = d.valueOf())) {
						s = realToJsex(t, log, sorting, jsonCompatible, dbg);
					} else {
						let c = [],
							n = Object.getOwnPropertyNames(d),
							m = Object.getOwnPropertySymbols(d);
						if (!jsonCompatible) {
							c.push('"__proto__":null');
						}
						for (let i = 0; i < n.length; i++) {
							let v = realToJsex(d[n[i]], log, sorting, jsonCompatible, dbg);
							if (v !== undefined) {
								c.push((!jsonCompatible && n[i] === '__proto__' ? '["__proto__"]' : strEncode(n[i], jsonCompatible)) + ':' + v);
							}
						}
						n = [];
						for (let i = 0; i < m.length; i++) {
							let v = realToJsex(d[m[i]], log, sorting, jsonCompatible, dbg);
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
					log.delete(d);
				}
			}
			return s;
		};

	//we want globalThis
	if (typeof globalThis === 'undefined') {
		self.globalThis = self;
	}

	//we need to make these constructors global
	globalThis.AsyncFunction = async function () { }.constructor;
	globalThis.GeneratorFunction = function* () { }.constructor;
	globalThis.AsyncGeneratorFunction = async function* () { }.constructor;

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
			m = [];
			l = 1;
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
			m = Object.create(null);
			l = 1;
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
		} else if (m = str.match(/^((?:Eval|Range|Reference|Syntax|Type|URI)?Error|(?:Async)?(?:Generator)?Function)\(/)) {
			l = m[0].length;
			if (str[l] === ')') {
				r = {
					value: globalThis[m[1]](),
					length: l + p + 1
				};
			} else {
				let n = str.substring(l).parseJsex();
				if (n && typeof n.value === 'string') {
					l += n.length;
					if (str[l] === ')') {
						r = {
							value: globalThis[m[1]](n.value),
							length: l + p + 1
						};
					} else if (str[l] === ',') {
						l += 1;
						let b = str.substring(l).parseJsex();
						if (b && typeof b.value === 'string') {
							l += b.length;
							if (str[l] === ')') {
								r = {
									value: globalThis[m[1]](n.value, b.value),
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

	//reference types are the names of their constructor, such as String, Uint8Array, AsyncFunction
	//primitive types are lowercased, such as string, bigint, null
	globalThis.dataType = data => {
		if (data == null) {
			return String(data);
		} else {
			let t = typeof data;
			if (['function', 'object'].indexOf(t) >= 0) {
				t = Object.prototype.toString.call(data);
				t = t.substring(8, t.length - 1);
			}
			return t;
		}
	};

	//serialize to jsex
	//sorting: whether sorting keys in Map, Set and Object
	//jsonCompatible: whether generate JSON compatible string. this argument makes sance only if data doesn't contain extended types
	//debug: whether throw error when meet unexpected data
	globalThis.toJsex = (data, sorting, jsonCompatible, debug) => realToJsex(data, new Set(), sorting, jsonCompatible, debug);

	//isEqual returns true if toJsex(o1, true) === toJsex(o2, true)
	//note: -0 does not equal to 0
	globalThis.isEqual = (o1, o2) => {
		if (Object.is(o1, o2)) {
			return true;
		} else {
			const types = ['undefined', 'null', 'boolean', 'string', 'number', 'bigint', 'Date', 'RegExp', 'Error', 'symbol', 'Function', 'AsyncFunction', 'GeneratorFunction', 'AsyncGeneratorFunction', 'Map', 'Set'],
				d1 = dataType(o1),
				d2 = dataType(o2),
				t1 = types.indexOf(d1),
				t2 = types.indexOf(d2);
			let v;
			if (t1 < 0 && typeof o1.valueOf === 'function' && o1 !== (v = o1.valueOf())) {
				return isEqual(v, o2);
			} else if (t2 < 0 && typeof o2.valueOf === 'function' && o2 !== (v = o2.valueOf())) {
				return isEqual(o1, v);
			} else if (t1 > 5) {
				if (t1 === t2) {
					if (t1 > 13) {
						if (o1.size === o2.size) {
							let m = [];
							for (let n of o1) {
								m.push(toJsex(n, true));
							}
							v = [];
							for (let n of o2) {
								v.push(toJsex(n, true));
							}
							return isEqual(m.sort(), v.sort());
						}
					} else if (t1 === 6) {
						return o1.getTime() === o2.getTime();
					} else if (t1 === 7) {
						return o1.toString() === o2.toString();
					} else if (t1 === 8) {
						if (o1.name === o2.name && o1.message === o2.message) {
							return o1.name === 'AggregateError' ? Array.isArray(o1.errors) && Array.isArray(o2.errors) && isEqual(o1.errors, o2.errors) : true;
						}
					} else {
						return toJsex(o1) === toJsex(o2);
					}
				}
			} else if (t1 < 0 && t2 < 0) {
				if (arrays.indexOf(d1) >= 0) {
					if (arrays.indexOf(d2) >= 0 && o1.length === o2.length) {
						for (let i = 0; i < o1.length; i++) {
							if (!isEqual(o1[i], o2[i])) {
								return false;
							}
						}
						return true;
					}
				} else {
					let m = Object.getOwnPropertyNames(o1);
					v = Object.getOwnPropertyNames(o2);
					if (m.length === v.length) {
						for (let i = 0; i < m.length; i++) {
							if (!hasOwnProperty.call(o2, m[i]) || !isEqual(o1[m[i]], o2[m[i]])) {
								return false;
							}
						}
						m = Object.getOwnPropertySymbols(o1);
						v = Object.getOwnPropertySymbols(o2);
						if (m.length === v.length) {
							return isEqual(m.map(n => toJsex([n, o1[n]], true)).sort(), v.map(n => toJsex([n, o2[n]], true)).sort());
						}
					}
				}
			}
		}
		return false;
	};
})();