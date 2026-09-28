/**
 * Shared loading indicators — one visual language for every async state:
 * route chunk loads, API fetches, form submissions.
 *
 * - <Spinner size/>      inline spinning ring (buttons, small areas)
 * - <LoadingOverlay/>    full-screen "talking to the cloud" takeover used by
 *                        Portal/AdminDashboard fetches and route fallbacks
 * - <PageLoader/>        Suspense fallback for lazy route chunks
 * All are pure CSS (no extra deps), instant on first paint (they ship in the
 * landing bundle), and announce themselves to screen readers via role="status".
 */

export function Spinner({ size = 'md', className = '' }) {
  const dims = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-10 w-10' : 'h-6 w-6'
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`nicc-spinner ${dims} ${className}`}
    />
  )
}

export function LoadingOverlay({ label = 'Contacting the cloud server…', sub = 'Fetching the latest data from Render. This can take a few seconds on a cold start.' }) {
  return (
    <div
      className="nicc-loading-overlay"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="nicc-spinner h-10 w-10" aria-hidden="true" />
      <p className="nicc-loading-title">{label}</p>
      <p className="nicc-loading-sub">{sub}</p>
    </div>
  )
}

export default function PageLoader({ label = 'Loading page…' }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 px-4 py-20 text-center"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="nicc-spinner h-10 w-10" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-600">{label}</p>
    </div>
  )
}
