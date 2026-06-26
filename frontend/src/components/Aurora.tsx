// Aurora background field — four drifting blurred color blobs + a faint
// dot-grid overlay, fixed behind all content (z-index:-2, non-interactive).
// Styling lives in globals.css (.aurora). prefers-reduced-motion stops the drift.
export default function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="a" />
      <span className="b" />
      <span className="c" />
      <span className="d" />
    </div>
  );
}
