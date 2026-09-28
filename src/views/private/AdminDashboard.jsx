import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SectionHeading from '../../components/common/SectionHeading.jsx'
import Card from '../../components/common/Card.jsx'
import Button from '../../components/common/Button.jsx'
import { Spinner, LoadingOverlay } from '../../components/common/PageLoader.jsx'
import { apiGetAdmin, authHeaders } from '../../utils/adminApi.js'
import { apiPost } from '../../utils/api.js'
import { useAuth } from '../../context/AuthContext.jsx'

const EMPTY_VISITORS = 'No visitor submissions recorded yet.'
const EMPTY_SIGNINS = 'No disciple sign-ins recorded yet.'
const EMPTY_MESSAGES = 'No visitor messages recorded yet.'
const EMPTY_FEEDBACK = 'No disciple feedback recorded yet.'

function matches(row, query, fields) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => String(row[f] ?? '').toLowerCase().includes(q))
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

function DataTable({ columns, rows, emptyText }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
        <p className="mb-3 text-slate-400"><i className="fas fa-inbox text-2xl" aria-hidden="true"></i></p>
        <p className="text-sm text-slate-500 font-medium">{emptyText}</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-left">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3 font-bold text-white whitespace-nowrap text-xs uppercase tracking-wider">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || r.email + i} className={`border-t border-slate-100 ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50/60 transition-colors`}>
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3 text-slate-700 whitespace-nowrap max-w-xs truncate" title={String(r[c.key] ?? '')}>
                  {c.render ? c.render(r) : (r[c.key] || '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ value }) {
  const pending = String(value || '').toLowerCase().includes('pending')
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${pending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
      {value || '—'}
    </span>
  )
}

function CategoryPill({ value }) {
  const v = String(value || '').toLowerCase()
  const tone = v.includes('prayer')
    ? 'bg-purple-100 text-purple-800'
    : v.includes('suggestion')
      ? 'bg-sky-100 text-sky-800'
      : 'bg-slate-100 text-slate-700'
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${tone}`}>
      {value || '—'}
    </span>
  )
}

function AdminStaffCard() {
  const staff = [
    { name: 'Tebo', role: 'Campus Leader', contact: '0793 025 511', tag: 'WhatsApp' },
    { name: 'Didi', role: 'Campus Leader', contact: '+27 82 469 6492', tag: 'WhatsApp' },
  ]
  return (
    <Card hover={false} className="p-6 sm:p-7">
      <h3 className="font-extrabold text-lg text-slate-900"><i className="fas fa-users mr-2 text-blue-700" aria-hidden="true"></i>Admin staff</h3>
      <p className="mt-1 text-sm text-slate-500">Ministry leaders with full dashboard access.</p>
      <ul className="mt-4 space-y-3">
        {staff.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3 odd:bg-white even:bg-gray-50">
            <span>
              <span className="block font-bold text-slate-900">{s.name} <span className="ml-1 text-[11px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">admin</span></span>
              <span className="block text-xs text-slate-500">{s.role} • {s.contact}</span>
            </span>
            <span className="text-xs font-bold text-slate-400">{s.tag}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('visitors')
  const [visitors, setVisitors] = useState([])
  const [signins, setSignins] = useState([])
  const [messages, setMessages] = useState([])
  const [feedback, setFeedback] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [announcementText, setAnnouncementText] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [v, s, m, f, a] = await Promise.all([
        apiGetAdmin('/api/admin/visitors'),
        apiGetAdmin('/api/admin/signins'),
        apiGetAdmin('/api/admin/messages'),
        apiGetAdmin('/api/admin/feedback'),
        apiGetAdmin('/api/admin/announcements'),
      ])
      setVisitors(Array.isArray(v) ? v : [])
      setSignins(Array.isArray(s) ? s : [])
      setMessages(Array.isArray(m) ? m : [])
      setFeedback(Array.isArray(f) ? f : [])
      setAnnouncements(Array.isArray(a) ? a : [])
    } catch (err) {
      setError(err.message || 'Could not load data from the cloud server. Check your connection and tap Refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  const filtV = useMemo(() => visitors.filter((r) => matches(r, search, ['name', 'email', 'phone', 'campus'])), [visitors, search])
  const filtS = useMemo(() => signins.filter((r) => matches(r, search, ['name', 'email'])), [signins, search])
  const filtM = useMemo(() => messages.filter((r) => matches(r, search, ['name', 'email', 'message'])), [messages, search])
  const filtF = useMemo(() => feedback.filter((r) => matches(r, search, ['name', 'email', 'category', 'message'])), [feedback, search])

  useEffect(() => { loadData() }, [loadData])
  const navigate = useNavigate()

  const handleLock = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handlePublishAnnouncement = async (e) => {
    e.preventDefault()
    setPublishMessage('')
    if (!announcementText.trim()) {
      setPublishMessage('Please write an announcement before publishing.')
      return
    }
    setPublishing(true)
    try {
      await apiPost('/api/admin/announcements', { message_text: announcementText.trim() }, { headers: authHeaders() })
      setAnnouncementText('')
      setPublishMessage('Announcement published successfully.')
      await loadData()
    } catch (err) {
      setPublishMessage(err.message || 'Could not publish announcement.')
    } finally {
      setPublishing(false)
    }
  }

  const tabs = [
    { id: 'visitors', label: `Visitor Submissions Log (${filtV.length})`, icon: 'fas fa-clipboard-list' },
    { id: 'signins', label: `Disciple Sign-In Log (${filtS.length})`, icon: 'fas fa-lock' },
    { id: 'messages', label: `Submitted Messages (${filtM.length})`, icon: 'fas fa-comment-alt' },
    { id: 'feedback', label: `Disciple Feedback (${filtF.length})`, icon: 'fas fa-comment-dots' },
    { id: 'announcements', label: `Announcements (${announcements.length})`, icon: 'fas fa-bell' },
  ]

  const sLabel =
    activeTab === 'visitors' ? 'visitors'
      : activeTab === 'messages' ? 'messages'
        : activeTab === 'feedback' ? 'feedback'
          : 'sign-ins'
  const searchPlaceholder =
    activeTab === 'feedback'
      ? 'Filter instantly by name, email, category or message…'
      : 'Filter instantly by name or email…'
  return (
    <div className="container-shell py-14 sm:py-20 max-w-6xl mx-auto">
      <SectionHeading align="left" eyebrow="Church leaders" title="Admin Dashboard"
        description={`Signed in as ${user?.name || 'Admin'} - monitor visit plans, messages, disciple feedback and sign-ins.`} />
      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Admin tabs">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={activeTab === t.id}
            onClick={() => { setActiveTab(t.id); setSearch('') }}
            className={`px-4 py-2.5 rounded-full text-sm font-bold transition-colors ${activeTab === t.id ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <i className={`${t.icon} mr-1.5`} aria-hidden="true"></i>{t.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} aria-busy={loading}>
            {loading ? (<span className="inline-flex items-center gap-2"><Spinner size="sm" />Refreshing…</span>) : 'Refresh'}
          </Button>
          <Button variant="dark" size="sm" onClick={handleLock}>Lock dashboard</Button>
        </div>
      </div>
      {error && <p role="alert" className="mb-4 text-sm bg-red-50 text-red-700 px-4 py-2.5 rounded-xl">{error}</p>}
      {/* Immediate loading state: the 5 admin fetches hit the Render cloud,
          which can take ~30–50 s on a cold start. This overlay renders on the
          same frame as navigation so users never see a blank page. */}
      {loading && !error && (
        <Card hover={false} className="p-6 sm:p-7 mb-6">
          <LoadingOverlay label="Loading dashboard data…" sub="Contacting the cloud server. First load can take up to a minute on a cold start — please wait." />
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card hover={false} className="p-6 sm:p-7">
            {activeTab === 'announcements' ? (
              <div role="tabpanel" aria-label="Publish announcements">
                <h2 className="text-xl font-extrabold text-slate-900">Publish an announcement</h2>
                <p className="mt-1 text-sm text-slate-500">This update will appear in every signed-in disciple's notification bell within 10 seconds.</p>
                <form onSubmit={handlePublishAnnouncement} className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="announcement-text" className="text-sm font-semibold text-slate-700">Announcement</label>
                    <textarea id="announcement-text" value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} maxLength={1000} rows={5}
                      placeholder="Write a clear update for all disciples…" className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                    <p className="mt-1 text-right text-xs text-slate-400">{announcementText.length} / 1,000</p>
                  </div>
                  {publishMessage && <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">{publishMessage}</p>}
                  <Button type="submit" disabled={publishing} aria-busy={publishing}>
                    {publishing
                      ? (<span className="inline-flex items-center gap-2"><Spinner size="sm" />Publishing…</span>)
                      : 'Publish Announcement'}
                  </Button>
                </form>
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h3 className="font-extrabold text-slate-900">Published announcements</h3>
                  {announcements.length === 0 ? <p className="mt-3 text-sm text-slate-500">No announcements published yet.</p> : (
                    <ul className="mt-4 space-y-3">
                      {announcements.map((item) => (
                        <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="whitespace-pre-wrap text-sm text-slate-700">{item.message_text}</p>
                          <p className="mt-2 text-xs text-slate-500">{formatDate(item.created_at)} • {item.user_ids.length} disciple(s) read</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <>
            <div className="mb-4">
              <label className="text-sm font-semibold text-slate-700">Search {sLabel}</label>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            {activeTab === 'visitors' && (
              <div role="tabpanel">
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
                    { key: 'name', label: 'Name' },
                    { key: 'phone', label: 'Phone Number' },
                    { key: 'campus', label: 'Selected Campus' },
                    { key: 'status', label: 'Follow-up Status', render: (r) => <StatusPill value={r.status} /> },
                  ]}
                  rows={filtV} emptyText={EMPTY_VISITORS} />
              </div>
            )}
            {activeTab === 'signins' && (
              <div role="tabpanel">
                <DataTable
                  columns={[
                    { key: 'timestamp', label: 'Timestamp', render: (r) => formatDate(r.timestamp) },
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                  ]}
                  rows={filtS} emptyText={EMPTY_SIGNINS} />
                <p className="mt-3 text-xs text-slate-400">OTP sign-ins only. Passwords are never stored or shown.</p>
              </div>
            )}
            {activeTab === 'messages' && (
              <div role="tabpanel">
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'message', label: 'Message' },
                  ]}
                  rows={filtM} emptyText={EMPTY_MESSAGES} />
              </div>
            )}
            {activeTab === 'feedback' && (
              <div role="tabpanel">
                <DataTable
                  columns={[
                    { key: 'timestamp', label: 'Date', render: (r) => formatDate(r.timestamp) },
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'category', label: 'Category', render: (r) => <CategoryPill value={r.category} /> },
                    { key: 'message', label: 'Feedback' },
                  ]}
                  rows={filtF} emptyText={EMPTY_FEEDBACK} />
                <p className="mt-3 text-xs text-slate-400">Submitted by signed-in disciples from the portal. Stored in feedback.csv.</p>
              </div>
            )}
              </>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <AdminStaffCard />
          <Card hover={false} className="p-6 sm:p-7">
            <h3 className="font-extrabold text-lg text-slate-900">Data files</h3>
            <p className="mt-1 text-sm text-slate-500"><code>visitors.csv</code> • <code>messages.csv</code> • <code>sign_ins.csv</code> • <code>feedback.csv</code> • <code>announcements.csv</code></p>
          </Card>
        </div>
      </div>
    </div>
  )
}
