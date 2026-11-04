/** What a failed write says. Network errors become one plain line; the database's own messages stay. */
export function failure(e: unknown) {
  const text = e instanceof Error ? e.message : '';
  if (!navigator.onLine || /fetch|Load failed|NetworkError/i.test(text))
    return 'Couldn’t save. Check your connection.';
  return text || 'Something went wrong. Try again.';
}
