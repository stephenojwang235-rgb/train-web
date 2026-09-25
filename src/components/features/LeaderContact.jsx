import Card from '../common/Card.jsx'
import { campusLeaders } from '../../data/site.js'

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M12.04 2a9.87 9.87 0 0 0-8.5 14.74L2 22l5.4-1.5A9.87 9.87 0 1 0 12.04 2Zm0 1.8a8.07 8.07 0 1 1-4.12 15l-.3.18-3.12.86.87-3.04.2-.32a8.07 8.07 0 0 1 6.47-12.68Zm-3.5 4.24c-.18 0-.47.07-.72.34-.24.27-.94.92-.94 2.24s.96 2.6 1.1 2.78c.13.18 1.88 3 4.7 4.02 2.34.85 2.82.68 3.33.64.5-.05 1.63-.67 1.86-1.31.23-.65.23-1.2.16-1.31-.06-.12-.24-.18-.5-.32-.27-.13-1.58-.78-1.83-.87-.24-.09-.42-.13-.6.14-.18.27-.68.87-.84 1.05-.15.18-.31.2-.57.07a7.3 7.3 0 0 1-2.15-1.33 8.05 8.05 0 0 1-1.49-1.86c-.15-.27-.02-.41.12-.55.12-.12.27-.31.4-.47.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.47-.07-.14-.6-1.46-.82-2-.22-.53-.44-.46-.6-.47h-.51Z" />
    </svg>
  )
}

/**
 * Contact Our Leaders — WhatsApp Tebo & Didi
 * Used on About page.
 */
export default function LeaderContact() {
  return (
    <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
      {campusLeaders.map((leader) => (
        <Card key={leader.id} hover={false} className="p-6 sm:p-7 text-center">
          <span
            aria-hidden="true"
            className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-2xl font-black text-emerald-800"
          >
            {leader.name.charAt(0)}
          </span>
          <h3 className="mt-4 font-extrabold text-xl text-slate-900">{leader.name}</h3>
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            {leader.role}
          </p>
          <p className="mt-2 text-slate-700 font-semibold">{leader.phoneDisplay}</p>
          <div className="mt-5 flex flex-col gap-2.5">
            <a
              href={leader.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm sm:text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-95"
            >
              <WhatsAppIcon /> WhatsApp {leader.name}
            </a>
            <a
              href={`tel:${leader.phoneRaw.replace(/\s/g, '')}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
            >
              Call {leader.phoneDisplay}
            </a>
          </div>
        </Card>
      ))}
    </div>
  )
}
