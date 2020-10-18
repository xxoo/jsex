(() => {
	'use strict';
	const arrays = ['Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'],
		wksbls = ['iterator', 'asyncIterator', 'match', 'matchAll', 'replace', 'search', 'split', 'hasInstance', 'isConcatSpreadable', 'unscopables', 'species', 'toPrimitive', 'toStringTag'],
		strEncode = str => {
			return '"' + str.replace(/[\\"\x00-\x08\x0a-\x1f\x7f\xff\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, a => {
				if (a === '\\') {
					return '\\\\';
				} else if (a === '"') {
					return '\\"';
				} else if (a === '\b') {
					return '\\b';
				} else if (a === '\n') {
					return '\\n';
				} else if (a === '\v') {
					return '\\v';
				} else if (a === '\f') {
					return '\\f';
				} else if (a === '\r') {
					return '\\r';
				} else {
					return escapeChar(a);
				}
			}) + '"';
		},
		escapeChar = a => {
			let c = a.charCodeAt(0);
			return (c < 16 ? '\\x0' : c < 256 ? '\\x' : c < 4096 ? '\\u0' : '\\u') + c.toString(16);
		};

	if (typeof globalThis === 'undefined') {
		self.globalThis = self;
	}
	//deserialize jsex, support JSON string
	String.prototype.parseJsex = function () {
		let m, l, r;
		if (this.substr(0, l = 4) === 'null') {
			r = {
				value: null,
				length: l
			};
		} else if (this.substr(0, l = 9) === 'undefined') {
			r = {
				value: undefined,
				length: l
			};
		} else if (this.substr(0, l = 8) === 'Infinity') {
			r = {
				value: Infinity,
				length: l
			};
		} else if (this.substr(0, l = 9) === '-Infinity') {
			r = {
				value: -Infinity,
				length: l
			};
		} else if (this.substr(0, l = 3) === 'NaN') {
			r = {
				value: NaN,
				length: l
			};
		} else if (this.substr(0, l = 4) === 'true') {
			r = {
				value: true,
				length: l
			};
		} else if (this.substr(0, l = 5) === 'false') {
			r = {
				value: false,
				length: l
			};
		} else if (this.substr(0, l = 9) === 'new Date(') {
			m = this.substr(l).parseJsex();
			if (m && typeof m.value === 'number' && this.charAt(l += m.length) === ')') {
				r = {
					value: new Date(m.value),
					length: l + 1
				};
			}
		} else if (this.substr(0, l = 6) === 'Symbol') {
			if (this.charAt(l) === '(') {
				l += 1;
				if (this.charAt(l) === ')') {
					r = {
						value: Symbol(),
						length: l + 1
					};
				} else {
					m = this.substr(l).parseJsex();
					if (m && typeof m.value === 'string') {
						l += m.length;
						if (this.charAt(l) === ')') {
							r = {
								value: Symbol(m.value),
								length: l + 1
							};
						}
					}
				}
			} else if (this.substr(l, 5) === '.for(') {
				l += 5;
				m = this.substr(l).parseJsex();
				if (m && typeof m.value === 'string') {
					l += m.length;
					if (this.charAt(l) === ')') {
						r = {
							value: Symbol.for(m.value),
							length: l + 1
						};
					}
				}
			} else if (this.charAt(l) === '.') {
				l += 1;
				for (let i = 0; i < wksbls.length; i++) {
					if (this.substr(l, wksbls[i].length) === wksbls[i]) {
						r = {
							value: Symbol[wksbls[i]],
							length: l + wksbls[i].length
						};
						break;
					}
				}
			}
		} else if (this.substr(0, l = 8) === 'new Set(') {
			m = this.substr(l).parseJsex();
			if (m && Array.isArray(m.value) && this.charAt(l += m.length) === ')') {
				r = {
					value: new Set(m.value),
					length: l + 1
				};
			}
		} else if (this.substr(0, l = 8) === 'new Map(') {
			m = this.substr(l).parseJsex();
			if (m && Array.isArray(m.value) && this.charAt(l += m.length) === ')') {
				for (let i = 0; i < m.value.length; i++) {
					if (!Array.isArray(m.value[i]) || m.value[i].length !== 2) {
						m.e = true;
						break;
					}
				}
				if (!m.e) {
					r = {
						value: new Map(m.value),
						length: l + 1
					};
				}
			}
		} else if (this.charAt(0) === '[') {
			let mf,
				ml = true,
				me = true,
				mq = false,
				mn = false;
			m = [];
			l = 1;
			while (!(mn || (me && this.charAt(l) === ']'))) {
				if (mq) {
					if (this.charAt(l) === ',') {
						l += 1;
						ml = true;
						me = mq = false;
						continue;
					}
				} else if (ml) {
					mf = this.substr(l).parseJsex();
					if (mf) {
						l += mf.length;
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
					length: l + 1
				};
			}
		} else if (this.charAt(0) === '{') {
			let mf,
				ml = true,
				me = true,
				mq = false,
				mn = false,
				mm = '';
			m = Object.create(null);
			l = 1;
			while (!(mn || (me && this.charAt(l) === '}'))) {
				if (mq) {
					if (this.charAt(l) === ',') {
						l += 1;
						ml = true;
						me = mq = false;
						continue;
					}
				} else if (ml) {
					mf = this.substr(l).parseJsex();
					if (mf && (typeof mf.value === 'string' || (Array.isArray(mf.value) && mf.value.length === 1 && typeof mf.value[0] === 'symbol'))) {
						l += mf.length;
						mm = typeof mf.value === 'string' ? mf.value : mf.value[0];
						if (!(mm in m) && this.charAt(l) === ':') { //disallow index duplication
							l += 1;
							mf = this.substr(l).parseJsex();
							if (mf) {
								l += mf.length;
								if (mm !== '__proto__') {
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
					length: l + 1
				};
			}
		} else if (m = this.match(/^(-?\d+)n/)) {
			r = {
				value: BigInt(m[1]),
				length: m[0].length
			};
		} else if (m = this.match(/^-?\d+(?:\.\d+)?(?:[Ee][+\-]?\d+)?/)) {
			r = {
				value: +m[0],
				length: m[0].length
			};
		} else if (m = this.match(/^"(?:(?:[^\x00-\x08\x0a-\x1f\x7f\xff\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069"]|\\")*?[^\\\x00-\x08\x0a-\x1f\x7f\xff\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069])??(?:\\\\)*"/)) {
			try {
				r = {
					value: m[0].replace(/^"|"$|\\[\\btnvfr"]|\\x[0-f]{2}|\\u[0-f]{4}|\\/g, a => {
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
							return String.fromCharCode('0x' + a.substr(2));
						} else {
							throw 'bad escape in string';
						}
					}),
					length: m[0].length
				};
			} catch (e) {}
		} else if (m = this.match(/^\/((?:\\\\)+|(?:[^\\\/]|[^\/][^\x00-\x08\x0a-\x1f\x7f\xff\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]*?[^\\\x00-\x08\x0a-\x1f\x7f\xff\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069])(?:\\\\)*)\/(g?i?m?s?u?y?)/)) {
			try {
				r = {
					value: RegExp(m[1], m[2]),
					length: m[0].length
				};
			} catch (e) {}
		} else if (m = this.match(/^(Range|Reference|Syntax|Type|URI|Eval)?Error\(/)) {
			l = m[0].length;
			m = {
				g: m[1]
			};
			if (m.g === 'Range') {
				m.g = RangeError;
			} else if (m.g === 'Reference') {
				m.g = ReferenceError;
			} else if (m.g === 'Syntax') {
				m.g = SyntaxError;
			} else if (m.g === 'Type') {
				m.g = TypeError;
			} else if (m.g === 'URI') {
				m.g = URIError;
			} else if (m.g === 'Eval') {
				m.g = EvalError;
			} else {
				m.g = Error;
			}
			if (this.charAt(l) === ')') {
				r = {
					value: m.g(),
					length: l + 1
				};
			} else {
				m.f = this.substr(l).parseJsex();
				if (m.f && typeof m.f.value === 'string') {
					l += m.f.length;
					if (this.charAt(l) === ')') {
						r = {
							value: m.g(m.f.value),
							length: l + 1
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
				t = Object.prototype.toString.call(a).replace(/^\[object |\]$/g, '');
			}
			return t;
		}
	};
	//serialize js data to jsex
	globalThis.toJsex = (d, sorting) => {
		let s;
		if (d == null) {
			s = String(d);
		} else {
			let t = dataType(d);
			if (t === 'string') {
				s = strEncode(d);
			} else if (t === 'boolean') {
				s = d.toString();
			} else if (t === 'number') {
				s = Object.is(d, -0) ? '-0' : d.toString();
			} else if (t === 'symbol') {
				for (let i = 0; i < wksbls.length; i++) {
					if (d === Symbol[wksbls[i]]) {
						s = 'Symbol.' + wksbls[i];
						break;
					}
				}
				if (!s) {
					s = Symbol.keyFor(d);
					if (typeof s === 'string') {
						s = 'Symbol.for(' + strEncode(s) + ')';
					} else if ('description' in Symbol.prototype) {
						s = 'Symbol(';
						if (d.description) {
							s += strEncode(d.description);
						}
						s += ')';
					} else {
						s = d.toString();
						if (s.length > 8) {
							s = 'Symbol(' + strEncode(s.substr(7, s.length - 8)) + ')';
						}
					}
				}
			} else if (t === 'bigint') {
				s = d + 'n';
			} else if (t === 'Date') {
				s = 'new Date(' + d.getTime() + ')';
			} else if (t === 'RegExp') {
				s = '/' + (d.source ? d.source.replace(/[\x00-\x08\x0a-\x1f\x7f\xff\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, a => {
					if (a === '\n') {
						return '\\n';
					} else if (a === '\v') {
						return '\\v';
					} else if (a === '\f') {
						return '\\f';
					} else if (a === '\r') {
						return '\\r';
					} else {
						return escapeChar(a);
					}
				}).replace(/^(?=\/)/, '\\').replace(/[^\\](\\\\)*(?=\/)/g, '$&\\') : '(?:)') + '/' + d.flags;
			} else if (t === 'Error') {
				s = ['RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'EvalError'].indexOf(d.name) < 0 ? 'Error' : d.name;
				s += '(';
				if (d.message) {
					s += strEncode(String(d.message));
				}
				s += ')';
			} else if (arrays.indexOf(t) >= 0) {
				s = '[';
				for (let i = 0; i < d.length; i++) {
					if (i > 0) {
						s += ',';
					}
					s += toJsex(d[i], sorting);
				}
				s += ']';
			} else if (['Map', 'Set'].indexOf(t) >= 0) {
				let c = [];
				for (let n of d) {
					c.push(toJsex(n, sorting));
				}
				if (sorting) {
					c.sort();
				}
				s = 'new ' + t + '([' + c.join(',') + '])';
			} else if (typeof d.valueOf === 'function' && d !== (t = d.valueOf())) {
				s = toJsex(t, sorting);
			} else {
				let c = [],
					n = Object.getOwnPropertyNames(d);
				t = typeof d !== 'function';
				if (sorting) {
					n.sort();
				}
				for (let i = 0; i < n.length; i++) {
					if (n[i] !== '__proto__' && (t || n[i] !== 'prototype')) {
						c.push(strEncode(n[i]) + ':' + toJsex(d[n[i]], sorting));
					}
				}
				n = Object.getOwnPropertySymbols(d).map(v => '[' + toJsex(v, sorting) + ']:' + toJsex(d[v], sorting));
				if (sorting) {
					n.sort();
				}
				s = '{' + c.concat(n).join(',') + '}';
			}
		}
		return s;
	};
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
							v = [];
							for (let n of o1) {
								v.push(toJsex(n, true));
							}
							let m = [];
							for (let n of o2) {
								m.push(toJsex(n, true));
							}
							return isEqual(v.sort(), m.sort());
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
					v = Object.getOwnPropertyNames(o1);
					if (v.length === Object.getOwnPropertyNames(o2).length) {
						for (let i = 0; i < v.length; i++) {
							if (!Object.prototype.hasOwnProperty.call(o2, v[i]) || !isEqual(o1[v[i]], o2[v[i]])) {
								return false;
							}
						}
						let m = Object.getOwnPropertySymbols(o2);
						v = Object.getOwnPropertySymbols(o1);
						if (m.length === v.length) {
							return isEqual(m.map(n => toJsex([n, o2[n]], true)).sort(), v.map(n => toJsex([n, o1[n]], true)).sort());
						}
					}
				}
			}
		}
		return false;
	};

	globalThis.clearProto = o => {
		let t = dataType(o)
		if (t === 'Object') {
			Reflect.setPrototypeOf(o, null);
			for (let n in o) {
				clearProto(o[n]);
			}
		} else if (['Map', 'Set', 'Array'].indexOf(t) >= 0) {
			for (let n of o) {
				clearProto(n);
			}
		}
	};
})();