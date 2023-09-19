"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.identity = void 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const castTo = (value) => value;
exports.default = castTo;
/**
 * same as castTo, but parameter is already typed. And take advantage of autocomplete
 * eg cons a = {b: identity<Person>({
 * ...
 * // autocomplete works here. it doesnt work for castTo
 * })}
 */
const identity = (value) => value;
exports.identity = identity;
//# sourceMappingURL=cast-to.js.map