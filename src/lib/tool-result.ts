export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true as const };
}

/** Convert unknown error to errorResult — eliminates the repeated catch boilerplate. */
export const catchToolError = (err: unknown) =>
  errorResult(err instanceof Error ? err.message : String(err));
