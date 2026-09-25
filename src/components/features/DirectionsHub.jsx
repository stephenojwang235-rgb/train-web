import SectionHeading from '../common/SectionHeading.jsx'
import Card from '../common/Card.jsx'

export const locations = [
  {
    id: 'sunday-worship',
    icon: 'fas fa-church',
    title: 'Sunday Worship Service',
    time: 'Every Sunday at 10:00 AM',
    location: 'The Sarit Expo Centre, Westlands',
    // Official Directions API: origin=Current+Location forces live GPS route
    mapsUrl:
      'https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=The+Sarit+Expo+Centre+Nairobi',
  },
  {
    id: 'midweek-service',
    icon: 'fas fa-hands-praying',
    title: 'Mid-Week Service',
    time: 'Every Wednesday at 6:00 PM',
    location: 'Ufungamano House (State House Road)',
    // Official Directions API: origin=Current+Location forces live GPS route
    mapsUrl:
      'https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=Ufungamano+House+Nairobi',
  },
  {
    id: 'campus-bible-talk',
    icon: 'fas fa-book-open',
    title: 'Campus Bible Talk (Mashujaa Bible Talk)',
    time: 'Every Wednesday at 1:15 PM',
    location: 'UoN Chiromo Campus (Science & Tech Campus)',
    // Official Directions API: origin=Current+Location forces live GPS route
    mapsUrl:
      'https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=University+Of+Nairobi+Chiromo+Campus+Nairobi',
  },
  {
    id: 'campus-devotional',
    icon: 'fas fa-hands-praying',
    title: 'Campus Devotional',
    time: 'Every Friday at 5:30 PM',
    location: 'UoN Chiromo Campus (Science & Tech Campus)',
    // Official Directions API: origin=Current+Location forces live GPS route
    mapsUrl:
      'https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=University+Of+Nairobi+Chiromo+Campus+Nairobi',
  },
]

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5l3 2" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M9 7h8v8" />
    </svg>
  )
}

/**
 * DirectionsHub — "Join Us This Week"
 * Church ministry themed section with disclaimer + 4 location cards.
 */
export default function DirectionsHub() {
  return (
    <section className="container-shell py-14 sm:py-20">
      <SectionHeading
        eyebrow="Find your way"
        title="Join Us This Week"
        description="Four weekly gatherings — pick the one that fits you, then tap Get Directions and come as you are."
      />

      {/* Highlighted disclaimer callout banner */}
      <div
        role="note"
        className="max-w-5xl mx-auto mb-8 sm:mb-10 flex gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 sm:px-6 sm:py-5 shadow-sm"
      >
        <i aria-hidden="true" className="fas fa-thumbtack text-xl sm:text-2xl text-amber-700 mt-0.5"></i>
        <p className="text-sm sm:text-base font-semibold text-amber-900 leading-relaxed">
          Note: Our Campus Ministry is explicitly and exclusively located at the University of Nairobi (UoN) Chiromo Campus. We do not currently operate on any other university campus branches.
        </p>
      </div>

      {/* 4 location cards grid: 1 col mobile, 2 col tablet, balanced 2x2 on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5 sm:gap-6 max-w-5xl mx-auto">
        {locations.map((loc) => (
          <Card key={loc.id} hover={false} className="p-0 overflow-hidden flex flex-col">
            {/* Visual anchor header */}
            <div className="flex items-center gap-3 bg-slate-950 text-white px-6 py-5">
              <span
                aria-hidden="true"
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-400 text-lg shrink-0 text-slate-950"
              >
                <i className={loc.icon}></i>
              </span>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                {loc.title}
              </h3>
            </div>

            <div className="p-6 flex flex-col flex-1">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
                <ClockIcon />
                {loc.time}
              </p>
              <p className="mt-2.5 inline-flex items-start gap-2 text-sm sm:text-base text-slate-600 leading-relaxed">
                <span className="mt-0.5 text-blue-600">
                  <PinIcon />
                </span>
                {loc.location}
              </p>

              <div className="mt-auto pt-6">
                <a
                  href={loc.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors duration-200"
                >
                  Get Directions
                  <ArrowIcon />
                </a>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
