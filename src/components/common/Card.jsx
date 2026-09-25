export default function Card({ children, className = '', hover = true }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${
        hover ? 'transition-all duration-300 hover:shadow-xl hover:-translate-y-1' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
