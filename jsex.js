(() => {
	'use strict';
	const arrays = ['Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'],
		notproto = n => n !== 'prototype',
		skipblank = str => {
			let m = str.match(/^(?:[\t\n\r ]*(?:\/\*(?:.|\n)*?\*\/)*(?:\/\/[^\n\r]*)*)*/);
			if (m) {
				return m[0].length;
			} else {
				return 0;
			}
		},
		strEncode = (str, jsonCompatible) => {
			return '"' + str.replace(jsonCompatible ? /[\ud800-\udbff][\udc00-\udfff]|[\\"\x00-\x1f\ud800-\udfff]/g : /[\ud800-\udbff][\udc00-\udfff]|[\n\r\\"\ud800-\udfff]/g, a => {
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
		realToJsex = (d, log, sorting, jsonCompatible) => {
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
						if (!(t = s.match(/^Symbol\.(\w+)$/)) || Symbol[t[1]] !== d) {
							s = s ? 'Symbol(' + strEncode(s) + ')' : 'Symbol()';
						}
					}
				} else if (t === 'Date') {
					s = 'new Date(' + d.getTime() + ')';
				} else if (t === 'Error') {
					s = ['RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'EvalError'].indexOf(d.name) < 0 ? 'Error' : d.name;
					s += '(';
					if (d.message) {
						s += strEncode(d.message);
					}
					s += ')';
				} else if (log.has(d)) {
					throw TypeError('circular structure detected');
				} else {
					log.add(d);
					if (arrays.indexOf(t) >= 0) {
						s = '[';
						for (let i = 0; i < d.length; i++) {
							if (i > 0) {
								s += ',';
							}
							s += realToJsex(d[i], log, sorting, jsonCompatible);
						}
						s += ']';
					} else if (['Map', 'Set'].indexOf(t) >= 0) {
						let c = [];
						for (let n of d) {
							c.push(realToJsex(n, log, sorting, jsonCompatible));
						}
						if (sorting) {
							c.sort();
						}
						s = 'new ' + t + '([' + c.join(',') + '])';
					} else if (typeof d.valueOf === 'function' && d !== (t = d.valueOf())) {
						s = realToJsex(t, log, sorting, jsonCompatible);
					} else {
						let c = [],
							n = Object.getOwnPropertyNames(d);
						t = typeof d !== 'function';
						if (!jsonCompatible) {
							c.push('"__proto__":null');
						}
						for (let i = 0; i < n.length; i++) {
							if (t || notproto(n[i])) {
								c.push((!jsonCompatible && n[i] === '__proto__' ? '["__proto__"]' : strEncode(n[i], jsonCompatible)) + ':' + realToJsex(d[n[i]], log, sorting, jsonCompatible));
							}
						}
						n = Object.getOwnPropertySymbols(d).map(v => '[' + realToJsex(v) + ']:' + realToJsex(d[v], log, sorting, jsonCompatible));
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
	if (typeof globalThis === 'undefined') {
		self.globalThis = self;
	}
	//deserialize jsex, support JSON string
	String.prototype.parseJsex = function () {
		let m, l, r,
			p = skipblank(this),
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
		} else if (str.substring(0, l = 8) === 'new Set(') {
			m = str.substring(l).parseJsex();
			if (m && Array.isArray(m.value) && str[l += m.length] === ')') {
				r = {
					value: new Set(m.value),
					length: l + p + 1
				};
			}
		} else if (str.substring(0, l = 8) === 'new Map(') {
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
			} else if ((m = str.substring(l).match(/^\.(\w+)/)) && typeof Symbol[m[1]] === 'symbol') {
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
						l += skipblank(str.substring(l));
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
						l += skipblank(str.substring(l));
						mm = mm ? mf.value === '__proto__' ? null : mf.value : mf.value[0];
						if (str[l] === ':') {
							l += 1;
							mf = str.substring(l).parseJsex();
							if (mf) {
								l += mf.length;
								l += skipblank(str.substring(l));
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
		} else if (m = str.match(/^(-?)([1-9]\d*|0(?:[bB][01]+|[oO][0-7]+|[xX][0-fA-F]+)?)n/)) {
			r = {
				value: m[1] ? -BigInt(m[2]) : BigInt(m[2]),
				length: m[0].length + p
			};
		} else if (m = str.match(/^(-?)(Infinity|0(?:[bB][01]+|[oO][0-7]+|[xX][0-fA-F]+)|[1-9](?:\.\d+)?[eE][-+]?[1-9]\d*|(?:[1-9]\d*|0)(?:\.\d+)?)/)) {
			r = {
				value: m[1] ? -m[2] : +m[2],
				length: m[0].length + p
			};
		} else if (m = str.match(/^"(?:(?:[^\n\r"]|\\")*?[^\n\r\\])??(?:\\\\)*"/)) {
			try {
				r = {
					value: m[0].replace(/^"|"$|\\[\\btnvfr"]|\\x[0-fA-F]{2}|\\u([0-fA-F]{4}|\{[0-fA-F]{1,5}\})|\\/g, a => {
						if (a === '"') {
							return '';
						} else if (a === '\\\\') {
							return '\\';
						} else if (a === '\\"') {
							return '"';
						} else if (a === '\\b') {
							return '\b';
						} else if (a === '\\t') {
							return '	';
						} else if (a === '\\n') {
							return '\n';
						} else if (a === '\\v') {
							return '\v';
						} else if (a === '\\f') {
							return '\f';
						} else if (a === '\\r') {
							return '\r';
						} else if (a.length > 3) {
							if (a[2] === '{') {
								return String.fromCodePoint('0x' + a.substring(3, a.length - 1));
							} else {
								return String.fromCharCode('0x' + a.substring(2));
							}
						} else {
							throw 'bad escape in string';
						}
					}),
					length: m[0].length + p
				};
			} catch (e) { }
		} else if (m = str.match(/^\/((?:\\\\)+|(?:[^\\\/]|[^\/][^\n\r]*?[^\n\r\\])(?:\\\\)*)\/(g?i?m?s?u?y?)/)) {
			try {
				r = {
					value: RegExp(m[1], m[2]),
					length: m[0].length + p
				};
			} catch (e) { }
		} else if (m = str.match(/^(?:Aggregate|Eval|Range|Reference|Syntax|Type|URI)?Error\(/)) {
			l = m[0].length;
			if (str[l] === ')') {
				r = {
					value: globalThis[m[0]](),
					length: l + p + 1
				};
			} else {
				let n = str.substring(l).parseJsex();
				if (n && typeof n.value === 'string') {
					l += n.length;
					if (str[l] === ')') {
						r = {
							value: globalThis[m[0]](n.value),
							length: l + p + 1
						};
					}
				}
			}
		}
		return r;
	};
	//reference types are the names of their constructor, such as String, Uint8Array, AsyncFunction
	//primitive types are lowercased, such as string, bigint, null
	globalThis.dataType = a => {
		if (a == null) {
			return String(a);
		} else {
			let t = typeof a;
			if (['function', 'object'].indexOf(t) >= 0) {
				t = Object.prototype.toString.call(a);
				t = t.substring(8, t.length - 1);
			}
			return t;
		}
	};
	//serialize to jsex
	//sorting: whether sorting keys in Map, Set and Object
	//jsonCompatible: whether generate JSON compatible string. this argument makes sance only if data doesn't contain extended types
	globalThis.toJsex = (d, sorting, jsonCompatible) => realToJsex(d, new Set(), sorting, jsonCompatible);
	//isEqual returns true if toJsex(o1, true) === toJsex(o2, true)
	//note: -0 does not equal to 0
	globalThis.isEqual = (o1, o2) => {
		if (Object.is(o1, o2)) {
			return true;
		} else {
			const types = ['undefined', 'null', 'boolean', 'string', 'number', 'bigint', 'symbol', 'Date', 'RegExp', 'Error', 'Map', 'Set'],
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
					if (t1 > 9) {
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
					} else {
						return toJsex(o1) === toJsex(o2);
					}
				}
			} else if (t1 < 0) {
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
					if (typeof o1 !== 'function') {
						m = m.filter(notproto);
					}
					v = Object.getOwnPropertyNames(o2);
					if (typeof o2 !== 'function') {
						v = v.filter(notproto);
					}
					if (m.length === v.length) {
						for (let i = 0; i < m.length; i++) {
							if (!Object.prototype.hasOwnProperty.call(o2, m[i]) || !isEqual(o1[m[i]], o2[m[i]])) {
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