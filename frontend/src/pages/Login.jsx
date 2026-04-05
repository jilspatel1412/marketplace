import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setNeedsVerification(false); setLoading(true)
    try {
      const user = await login(form.username, form.password)
      if (user.role === 'seller') navigate('/seller/dashboard')
      else navigate('/')
    } catch (err) {
      const msg = err.response?.data?.detail
      const allErrors = err.response?.data
      // Check if the error is about email verification
      const errorText = typeof allErrors === 'object' ? JSON.stringify(allErrors) : String(msg || '')
      if (errorText.toLowerCase().includes('verify your email')) {
        setNeedsVerification(true)
        setError('Please verify your email before logging in. Check your inbox for the verification link.')
      } else {
        setError(msg || 'Invalid credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    const email = window.prompt('Enter your email address to resend verification:')
    if (!email) return
    try {
      await authAPI.resendVerification(email)
      setError('')
      setNeedsVerification(false)
      alert('Verification email sent! Check your inbox.')
    } catch {
      alert('Failed to send verification email. Try again.')
    }
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>SellIt</div>
          <h2>Welcome back</h2>
          <p style={{ color: 'var(--text2)', marginTop: 6 }}>Sign in to your account</p>
        </div>
        <div className="card card-body">
          {error && (
            <div className="alert alert-error">
              {error}
              {needsVerification && (
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={handleResend}>Resend Verification Email</button>
                </div>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text2)', marginTop: 16, fontSize: '0.9rem' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--accent)' }}>Sign up</Link>
        </p>
        <p style={{ textAlign: 'center', color: 'var(--text2)', marginTop: 8, fontSize: '0.9rem' }}>
          <Link to="/reset-password" style={{ color: 'var(--text2)' }}>Forgot password?</Link>
        </p>
      </div>
    </div>
  )
}
