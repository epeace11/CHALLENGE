export function Loading({ inline = false }: { inline?: boolean }) {
  return (
    <div
      className={inline ? 'loading inline' : 'loading'}
      // A block-level live region; <output> is inline.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="status"
      aria-live="polite"
    >
      {!inline && <p className="brand">30 DAY CHALLENGE</p>}
      <div className="orbit" aria-hidden="true">
        <i />
      </div>
      <p className="loading-text">Opening your challenge…</p>
    </div>
  );
}
