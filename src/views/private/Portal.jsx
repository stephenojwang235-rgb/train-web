import { useCallback, useEffect, useMemo, useState } from 'react'
import SectionHeading from '../../components/common/SectionHeading.jsx'
import Card from '../../components/common/Card.jsx'
import Button from '../../components/common/Button.jsx'
import { Spinner } from '../../components/common/PageLoader.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { apiGet, apiPost } from '../../utils/api.js'

const churchSchedule = [
  {
    icon: 'fas fa-church',
    title: 'Sunday Service',
    time: 'Sundays at 10:00 AM',
    location: 'Sarit Expo Maranga Hall',
  },
  {
    icon: 'fas fa-hands-praying',
    title: 'Midweek Service',
    time: 'Wednesdays at 6:00 PM',
    location: 'Ufungamano House',
  },
  {
    icon: 'fas fa-book-open',
    title: 'Campus Bible Talk (Mashujaa Bible Talk)',
    time: 'Wednesdays at 1:15 PM',
    location: 'Chiromo Campus, UoN',
  },
]

const FEEDBACK_CATEGORIES = ['Prayer Request', 'Suggestion', 'Message']
const POLL_INTERVAL_MS = 10_000

function userAuthHeaders() {
  try {
    const token = localStorage.getItem('nicc-user-token') || ''
    return token ? { 'x-user-token': token } : {}
  } catch {
    return {}
  }
}

function AnnouncementBell() {
  const [announcements, setAnnouncements] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [dismissError, setDismissError] = useState('')

  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await apiGet('/api/announcements', { headers: userAuthHeaders() })
      setAnnouncements(Array.isArray(data.announcements) ? data.announcements : [])
      setUnreadCount(Number(data.unread_count) || 0)
      setError('')
    } catch (err) {
      if (err.message !== 'Disciple login required.') setError(err.message)
    }
  }, [])

  useEffect(() => {
    loadAnnouncements()
    const interval = window.setInterval(loadAnnouncements, POLL_INTERVAL_MS)
    const refresh = () => { if (document.visibilityState === 'visible') loadAnnouncements() }
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [loadAnnouncements])

  const markRead = async (id) => {
    setDismissError('')
    try {
      await apiPost(`/api/announcements/${encodeURIComponent(id)}/read`, {}, { headers: userAuthHeaders() })
      setAnnouncements((items) => items.filter((item) => item.id !== id))
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch (err) {
      setDismissError(err.message || 'Could not dismiss announcement.')
    }
  }

  return (
    <section className="mb-8" aria-labelledby="announcements-heading">
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="announcement-list"
          className="relative inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2.5 text-sm font-bold text-blue-800 shadow-sm hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">
          <i className="fas fa-bell" aria-hidden="true"></i>
          <span>Announcements</span>
          {unreadCount > 0 && <span className="flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white" aria-label={`${unreadCount} unread`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}
      {dismissError && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{dismissError}</p>}
      {open && (
        <div id="announcement-list" className="mt-4 space-y-3" aria-live="polite">
          <h2 id="announcements-heading" className="sr-only">Campus announcements</h2>
          {announcements.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No announcements have been published yet.</p>
          ) : announcements.map((item) => (
            <article key={item.id} className={`rounded-2xl border p-5 shadow-sm ${item.unread ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold text-slate-900">Ministry update</h3>
                    {item.unread && <span className="rounded-full bg-blue-700 px-2.5 py-1 text-xs font-bold text-white">New</span>}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.message_text}</p>
                  <p className="mt-2 text-xs text-slate-500">Published {new Date(item.created_at).toLocaleString()}</p>
                </div>
                {item.unread && <button type="button" onClick={() => markRead(item.id)} className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-600">Mark as read</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default function Portal() {
  const { user } = useAuth()
  const displayName = user?.name ?? 'Disciple'

  // Feedback form state
  const [feedbackCategory, setFeedbackCategory] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const [feedbackSuccess, setFeedbackSuccess] = useState('')
  const [feedbackError, setFeedbackError] = useState('')

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault()
    setFeedbackError('')
    setFeedbackSuccess('')
    if (!feedbackCategory) { setFeedbackError('Please select a category.'); return }
    if (!feedbackMessage.trim()) { setFeedbackError('Please write a message.'); return }
    setFeedbackBusy(true)
    try {
      const data = await apiPost('/api/feedback', {
        email: user?.email || '',
        name: user?.name || '',
        category: feedbackCategory,
        message: feedbackMessage.trim(),
      })
      if (data?.ok) {
        setFeedbackSuccess('Feedback submitted successfully!')
        setFeedbackCategory('')
        setFeedbackMessage('')
      }
    } catch (err) {
      setFeedbackError(err.message || 'Could not submit feedback.')
    } finally {
      setFeedbackBusy(false)
    }
  }

  return (
    <div className="container-shell py-14 sm:py-20">
      <SectionHeading
        align="left"
        eyebrow="Disciple Portal"
        title={`Welcome, ${displayName}`}
        description="Your discipleship journey at a glance — growth, groups and serving."
      />

      <AnnouncementBell />

            {/* Church Schedule */}
      <div>
        <h2 className="font-extrabold text-2xl text-slate-900 mb-5">Church Schedule</h2>
        <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
          {churchSchedule.map((item) => (
            <Card key={item.title} hover={false} className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-700 text-base shrink-0">
                  <i className={item.icon} aria-hidden="true"></i>
                </span>
                <h3 className="font-extrabold text-lg text-slate-900">{item.title}</h3>
              </div>
              <p className="text-sm text-slate-600">{item.time}</p>
              <p className="text-sm text-slate-500">{item.location}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Feedback Form */}
      <div className="mt-10">
        <Card hover={false} className="p-6 sm:p-8">
          <h2 className="font-extrabold text-2xl text-slate-900 mb-2">Send Feedback</h2>
          <p className="text-sm text-slate-500 mb-6">
            Share a prayer request, suggestion, or message with the ministry team.
          </p>
          <form onSubmit={handleFeedbackSubmit} className="space-y-5">
            <div>
              <label htmlFor="nicc-feedback-category" className="text-sm font-semibold text-slate-700">
                Category
              </label>
              <select
                id="nicc-feedback-category"
                name="category"
                value={feedbackCategory}
                onChange={(e) => setFeedbackCategory(e.target.value)}
                required
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Select a category…</option>
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nicc-feedback-message" className="text-sm font-semibold text-slate-700">
                Your Message
              </label>
              <textarea
                id="nicc-feedback-message"
                name="message"
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                required
                rows={4}
                placeholder="Write your prayer request, suggestion, or message here…"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
              />
            </div>
            {feedbackError && (
              <p role="alert" className="text-sm bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 rounded-xl">
                {feedbackError}
              </p>
            )}
            {feedbackSuccess && (
              <p role="status" aria-live="polite" className="text-sm bg-green-50 text-green-700 border border-green-200 px-4 py-2.5 rounded-xl">
                {feedbackSuccess}
              </p>
            )}
            <Button type="submit" disabled={feedbackBusy} aria-busy={feedbackBusy}>
              {feedbackBusy
                ? (<span className="inline-flex items-center gap-2"><Spinner size="sm" />Submitting…</span>)
                : 'Submit Feedback'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
