import Button from '../common/Button.jsx'

export default function Hero({ title, subtitle, primaryCta, secondaryCta }) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(60rem 30rem at 20% 10%, rgba(37,99,235,.5), transparent), radial-gradient(40rem 25rem at 85% 80%, rgba(245,158,11,.35), transparent)',
        }}
      />
      <div className="relative container-shell py-16 sm:py-24 lg:py-28 text-center">
        {/* Main NICC shield logo */}
        <img
          src="/logo.png"
          alt="Nairobi International Christian Church shield logo"
          className="w-40 sm:w-52 lg:w-60 h-auto mx-auto mb-8 drop-shadow-[0_20px_50px_rgba(245,158,11,0.35)]"
        />
        <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-amber-300 bg-white/10 px-4 py-2 rounded-full mb-6">
          Nairobi • Campus Ministry
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.05] max-w-4xl mx-auto">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        )}
        {(primaryCta || secondaryCta) && (
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            {primaryCta && (
              <Button to={primaryCta.to} variant="accent" size="lg">
                {primaryCta.label}
              </Button>
            )}
            {secondaryCta && (
              <Button to={secondaryCta.to} variant="outline" size="lg">
                {secondaryCta.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
