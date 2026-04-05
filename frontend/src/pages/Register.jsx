import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '', email: '', phone_number: '', password: '', password2: '', role: 'buyer',
    address_line1: '', city: '', state_province: '', postal_code: '', country: 'Canada',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.password2) {
      setError('Passwords do not match.')
      return
    }
    setError(''); setLoading(true)
    try {
      const res = await authAPI.register(form)
      setSuccess(res.data.message || 'Registration successful! Check your email to verify your account.')
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const messages = Object.values(data).flat()
        setError(messages.join(' '))
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!form.email) return
    setResending(true)
    try {
      await authAPI.resendVerification(form.email)
      setSuccess('Verification email resent! Please check your inbox.')
    } catch {
      setError('Failed to resend verification email.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>SellIt</div>
          <h2>Create your account</h2>
          <p style={{ color: 'var(--text2)', marginTop: 6 }}>Join the marketplace — buy or sell anything</p>
        </div>
        <div className="card card-body">
          {error && <div className="alert alert-error">{error}</div>}
          {success ? (
            <div className="alert alert-success">
              {success}
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexDirection: 'column' }}>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>Go to Login</button>
                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleResend} disabled={resending}>
                  {resending ? 'Resending...' : 'Resend Verification Email'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>I want to</label>
                <select value={form.role} onChange={set('role')}>
                  <option value="buyer">Buy items</option>
                  <option value="seller">Sell items</option>
                </select>
              </div>

              <div className="form-group">
                <label>Username</label>
                <input value={form.username} onChange={set('username')} required placeholder="Choose a unique username" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="tel" value={form.phone_number} onChange={set('phone_number')} required placeholder="+1 234 567 8900" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" value={form.password} onChange={set('password')} required />
                </div>
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input type="password" value={form.password2} onChange={set('password2')} required />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 4, marginBottom: 4 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
                  Shipping / Billing Address
                </div>
              </div>

              <div className="form-group">
                <label>Address Line 1</label>
                <input value={form.address_line1} onChange={set('address_line1')} required placeholder="123 Main Street, Unit 4" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input value={form.city} onChange={set('city')} required placeholder="Toronto" />
                </div>
                <div className="form-group">
                  <label>Province</label>
                  <input value={form.state_province} onChange={set('state_province')} required placeholder="Ontario" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Postal Code</label>
                  <input value={form.postal_code} onChange={set('postal_code')} required placeholder="M5V 3A8" />
                </div>
                <div className="form-group">
                  <label>Country</label>
                  <input value={form.country} onChange={set('country')} required placeholder="Canada" />
                </div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text2)', marginTop: 16, fontSize: '0.9rem' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
