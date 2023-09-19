export function invokeImmediately<ReturnType>(functionToInvoke: () => ReturnType): ReturnType {
  return functionToInvoke();
}

export const iif = invokeImmediately;

