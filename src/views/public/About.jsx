import SectionHeading from '../../components/common/SectionHeading.jsx'
import Card from '../../components/common/Card.jsx'
import LeaderContact from '../../components/features/LeaderContact.jsx'
import { locations } from '../../components/features/DirectionsHub.jsx'

const values = [
  { icon: 'fas fa-cross', title: 'Christ First', text: 'Jesus at the centre of study, friendships, dating, career and calling.' },
  { icon: 'fas fa-heart', title: 'Authentic Community', text: 'No masks. Real brotherhood and sisterhood that carries you through campus life.' },
  { icon: 'fas fa-globe-africa', title: 'Servant Leadership', text: 'Raising students who serve Nairobi and the nations with humility and excellence.' },
]

export default function About() {
  return (
    <div>
      <section className="bg-slate-950 text-white">
        <div className="container-shell py-14 sm:py-20 text-center">
          <p className="text-amber-300 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] mb-3">
            About us
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            A family for every student in Nairobi
          </h1>
          <p className="mt-4 text-slate-300 max-w-2xl mx-auto text-base sm:text-lg">
            NICC Campus Ministry is the university expression of the Nairobi
            International Christian Church — helping students follow Jesus
            and grow in faith, fellowship and purpose.
          </p>
        </div>
      </section>

      <section className="container-shell py-14 sm:py-20">
        <SectionHeading
          eyebrow="What we believe"
          title="Faith that works on campus"
          description="We teach the Bible, pray together, and live it out — in hostels, lecture halls and estates across the city."
        />
        <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
          {values.map((v) => (
            <Card key={v.title} className="p-6 sm:p-7 text-center">
              <div className="flex items-center justify-center w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-50 text-blue-700 text-xl">
                <i className={v.icon} aria-hidden="true"></i>
              </div>
              <h3 className="font-bold text-lg text-slate-900">{v.title}</h3>
              <p className="mt-2 text-slate-600 text-sm sm:text-base">{v.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-white border-y border-slate-100">
        <div className="container-shell py-14 sm:py-20">
          <SectionHeading
            eyebrow="Our purpose"
            title="Our Mission & Vision"
            description="We gather students, teach the Word and send others out to serve faithfully."
          />

          <div className="grid gap-6 lg:grid-cols-2 max-w-5xl mx-auto">
            <Card hover={false} className="p-6 sm:p-8 border-l-4 border-l-blue-600">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Matthew 28:19–20</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">Our Mission</h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                To make disciples of all nations, following the Great Commission
                given by Jesus in Matthew 28:19–20: go, make disciples, baptise
                them in the name of the Father, Son and Holy Spirit, and teach
                them to obey everything Jesus commanded.
              </p>
            </Card>
            <Card hover={false} className="p-6 sm:p-8 border-l-4 border-l-amber-400">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Our heart for the ministry</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">Our Vision</h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Focused on evangelizing the Word — helping every student hear,
                understand and live the Gospel through faithful biblical teaching,
                prayer and Christian community.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="container-shell py-14 sm:py-20">
        <SectionHeading
          eyebrow="Gather with us"
          title="Gatherings & Schedule"
          description="Choose a gathering below. Use the location button to open directions to the meeting venue."
        />

        <div className="grid gap-5 sm:gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {locations.slice(0, 3).map((loc) => (
            <Card key={loc.id} hover={false} className="p-0 overflow-hidden flex flex-col">
              <div className="bg-slate-950 text-white p-6">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-amber-400 text-slate-950 text-lg" aria-hidden="true">
                  <i className={loc.icon}></i>
                </span>
                <h3 className="mt-4 text-xl font-extrabold">{loc.title.replace(' (Mashujaa Bible Talk)', '')}</h3>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <p className="text-sm font-bold text-blue-700">
                  <i className="fas fa-clock mr-2" aria-hidden="true"></i>
                  {loc.id === 'sunday-worship' ? 'Time: ' : 'Day & time: '}
                  {loc.time.replace('Every ', '')}
                </p>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <i className="fas fa-map-marker-alt text-blue-600 mr-2" aria-hidden="true"></i>
                  {loc.location}
                </p>
                <a
                  href={loc.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 text-sm font-semibold transition-colors"
                >
                  📍 View {loc.id === 'sunday-worship' ? 'Sunday' : loc.id === 'midweek-service' ? 'Midweek' : 'Bible Talk'} Location
                </a>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* CONTACT OUR LEADERS VIA WHATSAPP */}
      <section className="container-shell pb-14 sm:pb-20">
        <SectionHeading
          eyebrow="Contact our leaders"
          title="Talk to Tebo & Didi on WhatsApp"
          description="Questions about faith, campus life, or your first visit? Message our campus leaders directly — Tebo on 0793025511 and Didi on +27824696492."
        />
        <LeaderContact />
        <p className="text-center text-sm text-slate-500 mt-6">
          Tap WhatsApp to chat instantly, or tap Call to phone directly.
        </p>
      </section>
    </div>
  )
}
