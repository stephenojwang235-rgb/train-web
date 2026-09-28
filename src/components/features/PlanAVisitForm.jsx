import { useState } from 'react'
import { apiPost } from '../../utils/api.js'
import { Spinner } from '../../components/common/PageLoader.jsx'

export const UON_CHIROMO = 'University of Nairobi (UoN) Chiromo Campus'
export const OTHER_VISITOR = 'Other / General Visitor'
const CAMPUS_OPTIONS = [UON_CHIROMO, OTHER_VISITOR]

const inputClass = (bad) =>
  `mt-1.5 w-full rounded-xl border px-4 py-3 text-sm text-slate-900 ` +
  `bg-white shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 ` +
  (bad
    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
    : 'border-slate-200 hover:border-slate-300 focus:border-blue-600 focus:ring-blue-600/25')

export default function PlanAVisitForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', campus: UON_CHIROMO })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState('')

  const update = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setErrors((p) => (p[name] ? { ...p, [name]: '' } : p))
  }

  const validate = () => {
    const n = {}
    if (!form.name.trim()) n.name = 'Please enter your full name.'
    if (!form.email.trim()) n.email = 'Please enter your email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) n.email = 'That email looks off — please check it.'
    if (!form.phone.trim()) n.phone = 'Please enter your phone number.'
    else if (!/^[+()\-\s\d]{7,17}$/.test(form.phone.trim())) n.phone = 'Please enter a valid phone number.'
    if (!form.campus) n.campus = 'Please choose a campus option.'
    setErrors(n)
    return Object.keys(n).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    setServerError('')
    if (!validate()) return
    setSaving(true)
    try {
      await apiPost('/api/visit-plan', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        campus: form.campus,
      })
      setSent(true)
    } catch (err) {
      setServerError(err.message || 'Could not reach the cloud server. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setForm({ name: '', email: '', phone: '', campus: UON_CHIROMO })
    setErrors({})
    setServerError('')
    setSent(false)
  }

  if (sent) {
    return (
      <div role="status" aria-live="polite" className="planvisit-in rounded-2xl border-2 border-green-300 bg-green-50 p-6 text-center sm:p-8">
        <div className="planvisit-pop mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-xl text-white shadow-lg shadow-green-500/30"><i className="fas fa-check" aria-hidden="true"></i></div>
        <h3 className="text-xl font-extrabold text-green-900">Visit planned — karibu!</h3>
        <p className="mx-auto mt-2 max-w-md leading-relaxed text-green-800">
          Thank you for planning a visit to Nairobi International Christian Church! Our campus ministry
          team will text or email you shortly to connect!
        </p>
        <button type="button" onClick={reset} className="mt-5 rounded-full bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2">
          Plan another visit
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="pav-name" className="text-sm font-semibold text-slate-700">Full Name</label>
        <input id="pav-name" name="name" type="text" autoComplete="name" value={form.name} onChange={update} placeholder="e.g. Grace Wanjiku" className={inputClass(errors.name)} />
        {errors.name && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.name}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pav-email" className="text-sm font-semibold text-slate-700">Email Address</label>
          <input id="pav-email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} placeholder="you@campus.ac.ke" className={inputClass(errors.email)} />
          {errors.email && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="pav-phone" className="text-sm font-semibold text-slate-700">Phone Number</label>
          <input id="pav-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} placeholder="07xx xxx xxx" className={inputClass(errors.phone)} />
          {errors.phone && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.phone}</p>}
        </div>
      </div>
      <div>
        <label htmlFor="pav-campus" className="text-sm font-semibold text-slate-700">Select Campus</label>
        <select id="pav-campus" name="campus" value={form.campus} onChange={update} className={`${inputClass(errors.campus)} cursor-pointer`}>
          {CAMPUS_OPTIONS.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <p className="mt-1.5 text-xs text-slate-500 inline-flex items-center gap-1.5"><i className="fas fa-map-marker-alt" aria-hidden="true"></i> Our ministry meets at UoN Chiromo — guests from anywhere are warmly welcome.</p>
        {errors.campus && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.campus}</p>}
      </div>
      {serverError && (<p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{serverError}</p>)}
      <button type="submit" disabled={saving} aria-busy={saving} className="w-full rounded-full bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-700/20 transition-all duration-200 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base">
        {saving
          ? (<span className="inline-flex items-center gap-2"><Spinner size="sm" />Sending…</span>)
          : 'Plan My Visit'}
      </button>
    </form>
  )
}
