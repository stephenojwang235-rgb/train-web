export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  dark = false,
}) {
  const alignCls = align === 'center' ? 'text-center mx-auto' : 'text-left'
  return (
    <div className={`max-w-2xl ${alignCls} mb-10 sm:mb-14`}>
      {eyebrow && (
        <p
          className={`text-xs sm:text-sm font-bold uppercase tracking-[0.2em] mb-3 ${
            dark ? 'text-amber-300' : 'text-blue-700'
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight ${
          dark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-4 text-base sm:text-lg leading-relaxed ${
            dark ? 'text-slate-200' : 'text-slate-600'
          }`}
        >
          {description}
        </p>
      )}
    </div>
  )
}
