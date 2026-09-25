import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Card from '../../components/common/Card.jsx'
import Button from '../../components/common/Button.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { apiPost } from '../../utils/api.js'

// Broad email format check that accepts ANY valid provider domain — educational
// (.ac.ke/.edu/.edu.au), corporate, custom, Outlook/Hotmail/Yahoo/Gmail etc.
// Mirrors HTML5 <input type="email"> rules (local@domain.tld) with no provider lock-in.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REMEMBER_KEY = 'nicc-remembered-email'

// Confirmation shown the moment a disciple finishes registration.
const REGISTRATION_SUCCESS_MESSAGE =
  'Account created successfully! You can now log in to the portal.'
// Any of these search params on /login means "you just registered":
//   /login?registered=true | ?registered=1 | ?registration=success | ?signup=1 | ?registered
const REGISTRATION_PARAMS = ['registered', 'registration', 'signup', 'registeredSuccess']
// A bare flag (?registered) or any of these values counts as success; ?registered=0 does not.
const REGISTRATION_TRUE_VALUES = ['true', '1', 'yes', 'success', 'ok']

export default function Login() {
  const { loginAsAdmin, loginWithUser, isAuthenticated, isAdmin } = useAuth()
  // Mode toggle: 'login' | 'signup'
  const [authMode, setAuthMode] = useState('login')
  // Phase 1: email + password (ONE unified login surface for everyone).
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(REMEMBER_KEY) || '' } catch { return '' }
  })
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  // Sign-up specific fields
  const [signUpName, setSignUpName] = useState('')
  const [signUpCampus, setSignUpCampus] = useState('')
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('')
  const [verificationPurpose, setVerificationPurpose] = useState('portal')
  // Phase 2: 6-digit verification code.
  const [step, setStep] = useState(1)
  const [otpCode, setOtpCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
    const [error, setError] = useState('')
  // Amber banner for "we could not email your code" — distinct from hard errors.
  const [warning, setWarning] = useState('')
  // Dedicated success alert - kept apart from `info` so a registration
  // confirmation always renders as a green "all good" banner.
  const [success, setSuccess] = useState('')
  // Forgot Password flow state
  const [forgotMode, setForgotMode] = useState(false)
  const [resetStep, setResetStep] = useState(1) // 1 = request code, 2 = verify + new password
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const from = location.state?.from || null
  const passwordUpdated = location.state?.passwordUpdated || false

  // A successful registration reaches /login two ways:
  //   1. router state -> navigate('/login', { state: { registrationSuccess: true } })
  //   2. URL parameter -> /login?registered=true (also ?registration=success, ?signup=1)
  const registrationParam = REGISTRATION_PARAMS.find((key) => searchParams.has(key)) || ''
  const registrationParamValue = registrationParam
    ? String(searchParams.get(registrationParam) ?? '').trim().toLowerCase()
    : ''
  const registrationViaUrl =
    Boolean(registrationParam) &&
    (registrationParamValue === '' || REGISTRATION_TRUE_VALUES.includes(registrationParamValue))
  const registrationViaState = location.state?.registrationSuccess === true
  const registrationSuccess = registrationViaState || registrationViaUrl

  useEffect(() => {
    if (isAuthenticated && !registrationSuccess) {
      if (from) navigate(from, { replace: true })
      else navigate(isAdmin ? '/admin' : '/portal', { replace: true })
    }
  }, [isAuthenticated, isAdmin, from, navigate, registrationSuccess])

  // Announce the successful registration, then consume the one-shot flag so a
  // refresh (or a re-used link) neither repeats nor re-triggers the banner.
  useEffect(() => {
    if (!registrationSuccess) return
    setAuthMode('login')
    setForgotMode(false)
    setStep(1)
    setResetStep(1)
    setError('')
    setInfo('')
    setSuccess(REGISTRATION_SUCCESS_MESSAGE)
    if (registrationViaUrl) {
      // Strip ?registered=... from the address bar, keeping any other params.
      const nextParams = new URLSearchParams(searchParams)
      REGISTRATION_PARAMS.forEach((key) => nextParams.delete(key))
      setSearchParams(nextParams, { replace: true })
    } else if (registrationViaState) {
      // Clear the router state so the message doesn't persist on refresh
      navigate('/login', { replace: true })
    }
  }, [registrationSuccess])

  const resetToPhase1 = () => {
    setStep(1); setOtpCode(''); setInfo(''); setError(''); setWarning('')
  }

  // ---- Forgot Password flow handlers ----
  const startForgotPassword = () => {
    setForgotMode(true)
    setResetStep(1)
    setResetCode('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setInfo('')
    setSuccess('')
    setWarning('')
  }

  const backToLogin = () => {
    setForgotMode(false)
    setResetStep(1)
    setStep(1)
    setOtpCode('')
    setError('')
    setInfo('')
    setWarning('')
  }

  const handleForgotRequest = async (e) => {
    e.preventDefault()
    setError(''); setInfo(''); setWarning('')
    const cleanEmail = String(email).trim()
    if (!cleanEmail) { setError('Please enter your email address.'); return }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid email address (any provider: school, Outlook, Yahoo, Gmail…).')
      return
    }
    setBusy(true)
    try {
      const data = await apiPost('/api/auth/forgot-password', { email: cleanEmail })
      if (data?.ok) {
        if (!data.emailSent) {
          setWarning(data.error || 'We could not email your reset code. Please try again shortly.')
        } else {
          setInfo(data.message || 'A reset code has been sent to your email. Check your inbox (and spam).')
          setResetStep(2)
        }
      }
    } catch (err) {
      setError(err.message || 'Could not process your request.')
    } finally { setBusy(false) }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError(''); setInfo('')
    if (!resetCode.trim()) { setError('Please enter the 6-digit reset code.'); return }
    if (!newPassword) { setError('Please enter a new password.'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return }
    setBusy(true)
    try {
      const data = await apiPost('/api/auth/reset-password', {
        email: String(email).trim(),
        code: resetCode,
        newPassword,
      })
      if (data?.ok) {
        setForgotMode(false)
        setResetStep(1)
        setResetCode('')
        setNewPassword('')
        setConfirmPassword('')
        navigate('/login', { state: { passwordUpdated: true }, replace: true })
      }
    } catch (err) {
      setError(err.message || 'Could not reset password.')
    } finally { setBusy(false) }
  }

  // ---- PHASE 1: Email + Password -> POST /api/auth/verify-credentials ----
  // Real <form> + submit + preventDefault so the browser natively prompts
  // "Save Password" while React still handles the response via fetch.
  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setInfo(''); setSuccess(''); setWarning('')
    const cleanEmail = String(email).trim().toLowerCase()
    if (!EMAIL_REGEX.test(cleanEmail)) return setError('Please enter a valid email address.')
    if (!password) return setError('Please enter your password.')
    if (remember) { try { localStorage.setItem(REMEMBER_KEY, cleanEmail) } catch {} } else { try { localStorage.removeItem(REMEMBER_KEY) } catch {} }
    setBusy(true)
    try {
      // Admin accounts use their dedicated session endpoint. Disciples use the
      // email-verified Portal Unlock flow so an admin email cannot be treated as
      // a disciple account (or receive the wrong error message).
      if (cleanEmail === 'stephenojwang235@gmail.com') {
        const adminData = await apiPost('/api/admin/login', {
          username: 'admin',
          email: cleanEmail,
          password,
        })
        loginAsAdmin(adminData.admin, adminData.token)
        navigate(from || '/admin', { replace: true })
        return
      }
      const data = await apiPost('/api/auth/portal-unlock', { email: cleanEmail, password })
      setVerificationPurpose(data.purpose || 'portal'); setStep(2); setInfo(data.message || 'Verification code sent.')
    } catch (err) { setError(err.message || 'Could not verify your credentials.') } finally { setBusy(false) }
  }

  // ---- PHASE 2: 6-digit code -> POST /api/auth/verify-otp ----
  const handleVerifyOtp = async (e) => {
    e.preventDefault(); setError(''); setInfo('')
    if (!/^\d{6}$/.test(otpCode.trim())) return setError('Enter the 6-digit code.')
    setBusy(true)
    try {
      const path = verificationPurpose === 'signup' ? '/api/auth/verify-signup' : '/api/auth/verify-portal'
      const data = await apiPost(path, { email: String(email).trim().toLowerCase(), code: otpCode.trim() })
      try { localStorage.setItem('nicc-user-token', data.token || '') } catch {}
      loginWithUser(data.user); setSuccess(data.message || 'Account created successfully!'); setTimeout(() => navigate(from || '/portal', { replace: true }), 700)
    } catch (err) { setError(err.message || 'Verification failed.') } finally { setBusy(false) }
  }

  // ---- SIGN UP: POST /api/auth/register ----
  const handleSignUp = async (e) => {
    e.preventDefault(); setError(''); setInfo(''); setSuccess('')
    const cleanEmail = String(email).trim().toLowerCase()
    if (!EMAIL_REGEX.test(cleanEmail)) return setError('Please enter a valid email address.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    setBusy(true)
    try {
      const data = await apiPost('/api/auth/signup', { email: cleanEmail, password })
      setVerificationPurpose('signup'); setStep(2); setInfo(data.message || 'Verification code sent.'); setPassword('')
    } catch (err) { setError(err.message || 'Could not create account.') } finally { setBusy(false) }
  }

  const handleResendCode = async () => {
    setError(''); setInfo(''); setWarning(''); setBusy(true)
    try {
      const data = await apiPost('/api/auth/resend-code', {
        email: String(email).trim().toLowerCase(), purpose: verificationPurpose,
      })
      setInfo(data.message || 'A new code has been sent to your email.')
    } catch (err) { setError(err.message || 'Could not resend the code.') } finally { setBusy(false) }
  }

  // Helper to switch between login and sign-up modes
  const switchToSignIn = () => {
    setAuthMode('login')
    setForgotMode(false)
    setStep(1)
    setResetStep(1)
    setError('')
    setInfo('')
    setSuccess('')
    setWarning('')
  }

  const switchToSignUp = () => {
    setAuthMode('signup')
    setForgotMode(false)
    setStep(1)
    setResetStep(1)
    setError('')
    setInfo('')
    setSuccess('')
    setWarning('')
  }

  return (
    <div className="container-shell py-14 sm:py-20">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <img
            src="/logo.png" alt="NICC Campus Ministry logo"
            className="mx-auto w-28 sm:w-32 mb-4 drop-shadow"
          />
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-blue-700 mb-3">
            NICC Campus Ministry
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            NICC Campus Ministry Portal
          </h1>
                    <p className="mt-3 text-slate-600">
            {authMode === 'signup'
              ? 'Create your disciple account to access the portal.'
              : forgotMode
                ? (resetStep === 1
                    ? 'Enter your email — we\'ll send a 6-digit reset code.'
                    : 'Enter the code and your new password below.')
                : (step === 1
                    ? 'One secure login for everyone.'
                    : `Code sent to ${String(email).trim()} — check your inbox + spam.`)}
          </p>
        </div>

        {/* Success banner — shown after a successful password reset */}
        {passwordUpdated && !forgotMode && (
          <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3.5 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-green-800">
              <i className="fas fa-check text-base" aria-hidden="true"></i>
              Password updated successfully! Please log in with your new password.
            </p>
          </div>
        )}

        {/* Success banner — shown after a successful registration, whether the
            signup redirect carried router state or a ?registered=… URL parameter */}
        {success && !forgotMode && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3.5 text-center"
          >
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-green-800">
              <i className="fas fa-check text-base" aria-hidden="true"></i>
              {success}
            </p>
          </div>
        )}

        <Card hover={false} className="p-6 sm:p-8">
                    {/* ---------- PHASE 1: Email + Password ---------- */}
          {!forgotMode && step === 1 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="nicc-email" className="text-sm font-semibold text-slate-700">
                  Email Address
                </label>
                                                                <input
                  id="nicc-email" name="email" type="email" required
                  pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                  autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@campus.ac.ke"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label htmlFor="nicc-password" className="text-sm font-semibold text-slate-700">
                  Password
                </label>
                <input
                  id="nicc-password" name="password" type="password" required
                  autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                            </div>
              {/* Forgot Password link — appears only on the login Phase 1 form */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={startForgotPassword}
                  className="text-sm font-bold text-blue-700 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox" name="remember" checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                Remember me
              </label>
{error && (
                <p className="text-sm bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 rounded-xl">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-sm bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-xl">
                  {info}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Verifying…' : 'Next'}
              </Button>
              <p className="text-center text-sm text-slate-500">
                Admin? Use{' '}
                <span className="font-mono font-semibold text-slate-700">admin@nicc.com</span>
                {' '}and your password. Disciples use their registered email.
              </p>
            </form>
          )}

          {/* ---------- SIGN UP FORM ---------- */}
          {authMode === 'signup' && !forgotMode && (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div>
                <label htmlFor="nicc-signup-email" className="text-sm font-semibold text-slate-700">Email Address</label>
                <input
                  id="nicc-signup-email" name="email" type="email" required
                  pattern="[^\s@]+@[^\s@]+\.[^\s@]+" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@campus.ac.ke"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label htmlFor="nicc-signup-password" className="text-sm font-semibold text-slate-700">Password</label>
                <input id="nicc-signup-password" name="password" type="password" required minLength={6}
                  autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                <p className="mt-1.5 text-xs text-slate-500">Use at least 6 characters.</p>
              </div>
              {error && (
                <p className="text-sm bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 rounded-xl">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-sm bg-green-50 text-green-700 border border-green-200 px-4 py-2.5 rounded-xl">
                  {info}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Creating Account…' : 'Create Account'}
              </Button>
            </form>
          )}

                    {/* ---------- PHASE 2: 6-Digit Verification Code ---------- */}
          {!forgotMode && step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500 truncate">
                  Signed in as{' '}
                  <span className="font-mono font-bold text-slate-800">{String(email).trim()}</span>
                </p>
                <button
                  type="button" onClick={resetToPhase1}
                  className="text-sm font-bold text-blue-700 hover:underline shrink-0"
                >
                  Back
                </button>
              </div>
              <div>
                <label htmlFor="nicc-otp" className="text-sm font-semibold text-slate-700">
                  6-Digit Verification Code
                </label>
                <input
                  id="nicc-otp" name="otp" value={otpCode} required
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456" inputMode="numeric" autoFocus
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm tracking-[0.3em] text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              {error && (
                <p className="text-sm bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 rounded-xl">
                  {error}
                </p>
              )}
              {warning && (
                <p className="text-sm bg-amber-50 text-amber-800 border border-amber-300 px-4 py-2.5 rounded-xl">
                  {warning}
                </p>
              )}
              {info && (
                <p className="text-sm bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-xl">
                  {info}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Verifying…' : 'Verify & Enter Portal'}
              </Button>
              <button type="button" onClick={handleResendCode} disabled={busy}
                className="mx-auto block text-sm font-bold text-blue-700 hover:underline disabled:opacity-50">
                {busy ? 'Sending…' : 'Resend Code'}
              </button>
                        </form>
          )}

          {/* ---------- RESET: Step 1 — Request Reset Code ---------- */}
          {forgotMode && resetStep === 1 && (
            <form onSubmit={handleForgotRequest} className="space-y-5">
              <div>
                <label htmlFor="nicc-reset-email" className="text-sm font-semibold text-slate-700">
                  Your Email Address
                </label>
                <input
                  id="nicc-reset-email" name="email" type="email" required
                  pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                  autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@campus.ac.ke"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Any valid email — school, Outlook, Yahoo, Gmail, or work.
                </p>
              </div>
              {error && (
                <p className="text-sm bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 rounded-xl">
                  {error}
                </p>
              )}
              {warning && (
                <p className="text-sm bg-amber-50 text-amber-800 border border-amber-300 px-4 py-2.5 rounded-xl">
                  {warning}
                </p>
              )}
              {info && (
                <p className="text-sm bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-xl">
                  {info}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Sending…' : 'Request Reset Code'}
              </Button>
              <button
                type="button"
                onClick={backToLogin}
                className="w-full text-center text-sm font-bold text-blue-700 hover:underline"
              >
                <i className="fas fa-arrow-left mr-1.5" aria-hidden="true"></i>Back to login
              </button>
            </form>
          )}

          {/* ---------- RESET: Step 2 — Verify Code + Set New Password ---------- */}
          {forgotMode && resetStep === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500 truncate">
                  Reset for{' '}
                  <span className="font-mono font-bold text-slate-800">{String(email).trim()}</span>
                </p>
                <button
                  type="button" onClick={() => setResetStep(1)}
                  className="text-sm font-bold text-blue-700 hover:underline shrink-0"
                >
                  Back
                </button>
              </div>

              <div>
                <label htmlFor="nicc-reset-code" className="text-sm font-semibold text-slate-700">
                  6-Digit Reset Code
                </label>
                <input
                  id="nicc-reset-code" name="resetCode" value={resetCode} required
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456" inputMode="numeric" autoFocus
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm tracking-[0.3em] text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="nicc-new-password" className="text-sm font-semibold text-slate-700">
                  New Password
                </label>
                <input
                  id="nicc-new-password" name="newPassword" type="password" required
                  autoComplete="new-password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="nicc-confirm-password" className="text-sm font-semibold text-slate-700">
                  Confirm New Password
                </label>
                <input
                  id="nicc-confirm-password" name="confirmPassword" type="password" required
                  autoComplete="new-password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {error && (
                <p className="text-sm bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 rounded-xl">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-sm bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-xl">
                  {info}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Resetting…' : 'Reset Password'}
              </Button>
              <button
                type="button"
                onClick={backToLogin}
                className="w-full text-center text-sm font-bold text-blue-700 hover:underline"
              >
                <i className="fas fa-arrow-left mr-1.5" aria-hidden="true"></i>Back to login
              </button>
            </form>
          )}
        </Card>
        {!forgotMode && (
          <div className="mt-6 space-y-3">
            {/* Toggle between Login and Sign Up */}
            {authMode === 'login' ? (
              <p className="text-center text-sm text-slate-500">
                New to NICC Campus?{' '}
                <button
                  type="button"
                  onClick={switchToSignUp}
                  className="font-bold text-blue-700 hover:underline"
                >
                  Create an account
                </button>
              </p>
            ) : (
              <p className="text-center text-sm text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={switchToSignIn}
                  className="font-bold text-blue-700 hover:underline"
                >
                  Log in
                </button>
              </p>
            )}
            <p className="text-center text-sm text-slate-500">
              Want to visit first?{' '}
              <Link to="/contact" className="font-bold text-blue-700 hover:underline">
                Plan your visit
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}