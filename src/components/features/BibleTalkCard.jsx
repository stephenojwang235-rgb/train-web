import { bibleTalk } from '../../data/site.js'

/**
 * CAMPUS BIBLE TALK (MASHUJAA BIBLE TALK) SECTION
 * UoN Chiromo Campus, every Wednesday 1:15 PM
 */
export default function BibleTalkCard() {
  return (
    <div className="max-w-5xl mx-auto overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-slate-950 text-white">
      <div className="grid md:grid-cols-[1.1fr_0.9fr]">
        {/* Visual anchor side */}
        <div className="relative p-6 sm:p-10 flex flex-col justify-center overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-50"
            style={{
              background:
                'radial-gradient(28rem 18rem at 15% 10%, rgba(52,211,153,.35), transparent), radial-gradient(30rem 20rem at 90% 90%, rgba(245,158,11,.30), transparent)',
            }}
          />
          <div className="relative">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
              <i aria-hidden="true" className={`${bibleTalk.icon} text-sm sm:text-base`}></i> {bibleTalk.eyebrow}
            </p>
            <h3 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              {bibleTalk.title}
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 text-slate-950 text-xs sm:text-sm font-extrabold px-3 py-1.5">
                <i aria-hidden="true" className="fas fa-map-marker-alt"></i> {bibleTalk.venue}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-white text-xs sm:text-sm font-semibold px-3 py-1.5">
                <i aria-hidden="true" className="fas fa-clock"></i> {bibleTalk.day} • {bibleTalk.time}
              </span>
            </div>
          </div>
        </div>

        {/* Details side — Name, Location, Time */}
        <div className="bg-white text-slate-900 p-6 sm:p-10 flex flex-col justify-center">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
            Service details
          </p>
          <dl className="mt-3 space-y-2.5 text-sm sm:text-base">
            <div className="flex gap-2">
              <dt className="font-bold text-slate-900">Name:</dt>
              <dd className="text-slate-700">{bibleTalk.title}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-slate-900">Location:</dt>
              <dd className="text-slate-700">{bibleTalk.venue}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-slate-900">Time:</dt>
              <dd className="text-slate-700">{bibleTalk.day} at {bibleTalk.time}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
