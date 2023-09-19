// eslint-disable-next-line @typescript-eslint/no-explicit-any
const castTo = <R>(value: R | any): R => (value as unknown) as R;
export default castTo;

/**
 * same as castTo, but parameter is already typed. And take advantage of autocomplete
 * eg cons a = {b: identity<Person>({
 * ...
 * // autocomplete works here. it doesnt work for castTo
 * })}
 */
export const identity = <Return>(value: Return): Return => value;
