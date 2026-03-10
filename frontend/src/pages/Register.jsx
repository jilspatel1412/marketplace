import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '', role: 'buyer' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await authAPI.register(form)
      setSuccess('Account created! Check your email to verify your account.')
    } catch (err) {
      const data = err.response?.data
      if (typeof data === 'object') {
        const msgs = Object.values(data).flat()
        setError(msgs.join(' '))
      } else {
        setError('Registration failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>SellIt</div>
          <h2>Create your account</h2>
        </div>
        <div className="card card-body">
          {error && <div className="alert alert-error">{error}</div>}
          {success ? (
            <div className="alert alert-success">
              {success}
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>Go to Login</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>I want to</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="buyer">Buy items</option>
                  <option value="seller">Sell items</option>
                </select>
              </div>
              <div className="form-group">
                <label>Username</label>
                <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Confirm</label>
                  <input type="password" value={form.password2} onChange={e => setForm({...form, password2: e.target.value})} required />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text2)', marginTop: 16, fontSize: '0.9rem' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
