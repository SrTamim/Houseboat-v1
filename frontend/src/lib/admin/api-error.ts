/** Extract the backend's error message from an axios failure, with a fallback. */
export function apiErrorMessage(e: unknown, fallback: string): string {
  const message =
    (e as { response?: { data?: { message?: unknown } } })?.response?.data
      ?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : fallback;
}
