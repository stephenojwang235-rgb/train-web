import { Link } from 'react-router-dom'
import { campusLeaders, contactInfo } from '../../data/site.js'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="container-shell py-12 sm:py-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <img
              src="/logo.png"
              alt="NICC shield logo"
              className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/20 bg-white"
            />
            <span className="font-extrabold text-white">
              NICC Campus Ministry
            </span>
          </div>
          <p className="text-sm sm:text-base text-slate-400 max-w-md leading-relaxed">
            Helping university students across Nairobi discover faith,
            friendship and purpose through Jesus Christ.
          </p>
          <div className="mt-5 space-y-2 text-sm">
            <p className="text-slate-300 font-semibold"><i className="fas fa-church w-5 mr-1" aria-hidden="true"></i>Sundays 10:00 AM • Sarit Expo</p>
            <p className="text-slate-400"><i className="fas fa-hands-praying w-5 mr-1" aria-hidden="true"></i>Wednesdays 6:00 PM • Ufungamano House</p>
            <p className="text-slate-400"><i className="fas fa-book-open w-5 mr-1" aria-hidden="true"></i>Campus Bible Talk (Mashujaa Bible Talk) Wed 1:15 PM • UoN Chiromo</p>
          </div>
        </div>

        <div>
          <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">
            Explore
          </h4>
          <ul className="space-y-2.5 text-sm">
            {[
              ['/', 'Home'],
              ['/about', 'About Us'],
              ['/contact', 'Contact'],
              ['/login', 'Login'],
            ].map(([to, label]) => (
              <li key={to + label}>
                <Link to={to} className="hover:text-amber-300 transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">
            Contact our leaders
          </h4>
          <ul className="space-y-3 text-sm">
            {campusLeaders.map((l) => (
              <li key={l.id}>
                <a
                  href={l.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 hover:bg-white/10 hover:border-emerald-400/40 transition"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#25D366] text-white shrink-0">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                      <path d="M12.04 2a9.87 9.87 0 0 0-8.5 14.74L2 22l5.4-1.5A9.87 9.87 0 1 0 12.04 2Zm0 1.8a8.07 8.07 0 1 1-4.12 15l-.3.18-3.12.86.87-3.04.2-.32a8.07 8.07 0 0 1 6.47-12.68Zm-3.5 4.24c-.18 0-.47.07-.72.34-.24.27-.94.92-.94 2.24s.96 2.6 1.1 2.78c.13.18 1.88 3 4.7 4.02 2.34.85 2.82.68 3.33.64.5-.05 1.63-.67 1.86-1.31.23-.65.23-1.2.16-1.31-.06-.12-.24-.18-.5-.32-.27-.13-1.58-.78-1.83-.87-.24-.09-.42-.13-.6.14-.18.27-.68.87-.84 1.05-.15.18-.31.2-.57.07a7.3 7.3 0 0 1-2.15-1.33 8.05 8.05 0 0 1-1.49-1.86c-.15-.27-.02-.41.12-.55.12-.12.27-.31.4-.47.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.47-.07-.14-.6-1.46-.82-2-.22-.53-.44-.46-.6-.47h-.51Z" />
                    </svg>
                  </span>
                  <span>
                    <span className="block font-bold text-white group-hover:text-emerald-300">
                      {l.name} • {l.phoneDisplay}
                    </span>
                    <span className="block text-xs text-slate-400 inline-flex items-center gap-1">Chat on WhatsApp <i className="fas fa-arrow-right text-[10px]" aria-hidden="true"></i></span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">{contactInfo.email}</p>
        </div>

        <div>
          <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">
            Campuses
          </h4>
          <ul className="space-y-2.5 text-sm text-slate-400">
            <li>University of Nairobi</li>
            <li>Kenyatta University</li>
            <li>Strathmore University</li>
            <li>JKUAT & Daystar</li>
          </ul>
          <Link
            to="/login"
            className="inline-flex mt-5 px-5 py-2.5 rounded-full bg-blue-700 text-white text-sm font-bold hover:bg-blue-600 transition"
          >
            Login
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-shell py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-500">
          <p>© {year} Nairobi International Christian Church. All rights reserved.</p>
          <p>Soli Deo Gloria — Faith, Fellowship & Purpose</p>
        </div>
      </div>
    </footer>
  )
}
