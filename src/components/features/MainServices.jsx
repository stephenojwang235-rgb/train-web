import Card from '../common/Card.jsx'
import { mainServices } from '../../data/site.js'

/**
 * MAIN CHURCH SERVICES SECTION
 * Sunday Service: Sarit Expo, every Sunday 10:00 AM
 * Mid-Week Service: Ufungamano House, every Wednesday 6:00 PM
 * Clean structural layout cards with visual anchors (icon, tag, time, venue).
 */
export default function MainServices() {
  return (
    <div className="grid gap-5 sm:gap-6 md:grid-cols-2 max-w-5xl mx-auto">
      {mainServices.map((s) => (
        <Card key={s.id} hover={false} className="p-0 overflow-hidden">
          {/* Visual anchor bar */}
          <div className="flex items-center gap-4 bg-slate-950 text-white px-6 sm:px-7 py-5">
            <span
              aria-hidden="true"
              className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-400 text-xl shrink-0 text-slate-950"
            >
              <i className={s.icon}></i>
            </span>
            <span>
              <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
                {s.tag} • {s.time}
              </span>
              <span className="block font-extrabold text-lg sm:text-xl leading-tight mt-0.5">
                {s.title}
              </span>
            </span>
          </div>

          <div className="p-6 sm:p-7">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-800 text-xs sm:text-sm font-bold px-3 py-1.5">
                <i aria-hidden="true" className="fas fa-map-marker-alt"></i> {s.venue}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold px-3 py-1.5">
                <i aria-hidden="true" className="fas fa-calendar-alt"></i> {s.day} • {s.time}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
