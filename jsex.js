(() => {
	'use strict';
	const pmtobjs = ['String', 'Number', 'Boolean', 'Symbol', 'BigInt'],
		arrays = ['Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'],
		wksbls = ['iterator', 'asyncIterator', 'match', 'replace', 'search', 'split', 'hasInstance', 'isConcatSpreadable', 'unscopables', 'species', 'toPrimitive', 'toStringTag'],
		samesetormap = (o1, o2) => {
			if (o2.get) {
				for (let n of o1) {
					if (!o2.has(n[0]) || !o2.get(n[0]) !== n[1]) {
						return;
					}
				}
			} else {
				for (let n of o1) {
					if (!o2.has(n)) {
						return;
					}
				}
			}
			return true;
		},
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
					let c = a.charCodeAt(0);
					return (c < 16 ? '\\x0' : c < 256 ? '\\x' : '\\u') + c.toString(16);
				}
			}) + '"';
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
	globalThis.toJsex = d => {
		let s;
		if (d == null) {
			s = String(d);
		} else {
			let t = dataType(d);
			if (pmtobjs.indexOf(t) >= 0) {
				d = d.valueOf();
				t = t.toLowerCase();
			}
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
					} else if (Symbol.prototype.hasOwnProperty('description')) {
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
						let c = a.charCodeAt(0);
						return (c < 16 ? '\\x0' : c < 256 ? '\\x' : '\\u') + c.toString(16);
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
					s += toJsex(d[i]);
				}
				s += ']';
			} else if (['Map', 'Set'].indexOf(t) >= 0) {
				let c = [];
				for (let n of d) {
					c.push(toJsex(n));
				}
				c.sort(); //this line can decrease performance but is needed by isEqual
				s = 'new ' + t + '([' + c.join(',') + '])';
			} else if (typeof d.toJsex === 'function') {
				s = toJsex(d.toJsex());
			} else {
				let c = [],
					n = Object.getOwnPropertyNames(d).sort(); //sort is needed by isEqual
				for (let i = 0; i < n.length; i++) {
					if (n[i] !== '__proto__') {
						c.push(strEncode(n[i]) + ':' + toJsex(d[n[i]]));
					}
				}
				s = '{' + c.concat(Object.getOwnPropertySymbols(d).map(v => '[' + toJsex(v) + ']:' + toJsex(d[v])).sort()).join(',') + '}';
			}
		}
		return s;
	};
	//isEqual returns true if toJsex(o1) equals toJsex(o2)
	//note: -0 does not equal to 0
	globalThis.isEqual = (o1, o2) => {
		let t1 = dataType(o1),
			t2 = dataType(o2);
		if (pmtobjs.indexOf(t1) >= 0) {
			o1 = o1.valueOf();
			t1 = t1.toLowerCase();
		}
		if (pmtobjs.indexOf(t2) >= 0) {
			o2 = o2.valueOf();
			t2 = t2.toLowerCase();
		}
		if (Object.is(o1, o2)) {
			return true;
		} else if (arrays.indexOf(t1) >= 0) {
			if (arrays.indexOf(t2) >= 0 && o1.length === o2.length) {
				for (let i = 0; i < o1.length; i++) {
					if (!isEqual(o1[i], o2[i])) {
						return;
					}
				}
				return true;
			}
		} else if (t1 === t2) {
			if (t1 === 'Date') {
				return o1.getTime() === o2.getTime();
			} else if (['RegExp', 'Error', 'symbol'].indexOf(t1) >= 0) {
				return toJsex(o1) === toJsex(o2);
			} else if (['Set', 'Map'].indexOf(t1) >= 0) {
				if (o1.size === o2.size) {
					if (samesetormap(o1, o2)) {
						return true;
					} else {
						let a1 = [],
							a2 = [];
						for (let n of o1) {
							a1.push(toJsex(n));
						}
						a1.sort();
						for (let n of o2) {
							a2.push(toJsex(n));
						}
						a2.sort();
						return isEqual(a1, a2);
					}
				}
			} else if (t1 === 'Object') {
				let n = Object.getOwnPropertyNames(o1);
				if (n.length === Object.getOwnPropertyNames(o2).length) {
					for (let i = 0; i < n.length; i++) {
						if (!Object.prototype.hasOwnProperty.call(o2, n[i]) || !isEqual(o1[n[i]], o2[n[i]])) {
							return;
						}
					}
					let m = Object.getOwnPropertySymbols(o2);
					n = Object.getOwnPropertySymbols(o1);
					if (m.length === n.length) {
						return isEqual(m.map(v => toJsex([v, o2[v]])).sort(), n.map(v => toJsex([v, o1[v]])).sort());
					}
				}
			}
		}
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