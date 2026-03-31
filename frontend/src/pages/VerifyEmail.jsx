import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { authAPI } from '../api'

export function VerifyEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying')
  const [resendEmail, setResendEmail] = useState('')
  const [resendMsg, setResendMsg] = useState('')
  const [resendLoading, setResendLoading] = useState(false)

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setStatus('no-token'); return }
    authAPI.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [params])

  const handleResend = async (e) => {
    e.preventDefault()
    setResendLoading(true)
    try {
      await authAPI.resendVerification(resendEmail)
      setResendMsg('Sent! Check your inbox for a new verification link.')
    } catch {
      setResendMsg('Something went wrong. Please try again.')
    } finally { setResendLoading(false) }
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        {status === 'verifying' && <><div className="spinner" /><p>Verifying your email...</p></>}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
            <h2>Email Verified!</h2>
            <p style={{ color: 'var(--text2)', margin: '12px 0 24px' }}>Your account is now active. You can log in.</p>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>Go to Login</button>
          </>
        )}

        {(status === 'error' || status === 'no-token') && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>❌</div>
            <h2>Verification Failed</h2>
            <p style={{ color: 'var(--text2)', margin: '12px 0 24px' }}>
              {status === 'no-token' ? 'No verification token found.' : 'This link is invalid or has already been used.'}
            </p>
            <div className="card card-body" style={{ textAlign: 'left', marginTop: 8 }}>
              <p style={{ fontWeight: 600, marginBottom: 12 }}>Resend verification email</p>
              {resendMsg ? (
                <div className="alert alert-success">{resendMsg}</div>
              ) : (
                <form onSubmit={handleResend}>
                  <div className="form-group">
                    <label>Your email address</label>
                    <input
                      type="email" required
                      value={resendEmail}
                      onChange={e => setResendEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={resendLoading} style={{ width: '100%' }}>
                    {resendLoading ? 'Sending...' : 'Resend Link'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const [step, setStep] = useState(token ? 'reset' : 'request')
  const [email, setEmail] = useState('')
  const [form, setForm] = useState({ password: '', password2: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRequest = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await authAPI.passwordResetRequest(email)
      setSuccess('If that email is registered, you will receive a reset link.')
    } catch { setError('Failed to send reset email.') }
    finally { setLoading(false) }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    if (form.password !== form.password2) { setError('Passwords do not match.'); return }
    setError(''); setLoading(true)
    try {
      await authAPI.passwordResetConfirm({ token, password: form.password })
      setSuccess('Password reset! Redirecting to login...')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Reset Password</h2>
        <div className="card card-body">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          {step === 'request' && !success && (
            <form onSubmit={handleRequest}>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
          {step === 'reset' && !success && (
            <form onSubmit={handleReset}>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input type="password" value={form.password2} onChange={e => setForm({...form, password2: e.target.value})} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Resetting...' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail
