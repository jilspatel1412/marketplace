import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api'

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState({ username: user?.username || '', bio: user?.bio || '', role: user?.role || '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setSaving(true)
    try {
      await authAPI.updateMe(form)
      await refreshUser()
      setSuccess('Profile updated!')
    } catch (err) {
      setError(err.response?.data?.detail || 'Update failed.')
    } finally { setSaving(false) }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="page-header">
          <h1>My Profile</h1>
        </div>
        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent)', flexShrink: 0 }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{user?.username}</div>
              <div style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>{user?.email}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span className="badge" style={{ background: 'rgba(255,77,0,0.1)', color: 'var(--accent)' }}>{user?.role}</span>
                {user?.is_verified && <span className="badge badge-active">Verified</span>}
              </div>
            </div>
          </div>

          {success && <div className="alert alert-success">{success}</div>}
          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Bio</label>
              <textarea rows={3} value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} placeholder="Tell buyers/sellers about yourself..." />
            </div>
            <div className="form-group">
              <label>Account Type</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text3)', marginBottom: 16 }}>
              Member since {new Date(user?.date_joined).toLocaleDateString()}
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
