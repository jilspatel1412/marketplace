import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api'

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState({
    username: user?.username || '',
    bio: user?.bio || '',
    phone_number: user?.phone_number || '',
    address_line1: user?.address_line1 || '',
    city: user?.city || '',
    state_province: user?.state_province || '',
    postal_code: user?.postal_code || '',
    country: user?.country || '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setSaving(true)
    try {
      await authAPI.updateMe(form)
      await refreshUser()
      setSuccess('Profile updated!')
    } catch (err) {
      const data = err.response?.data
      setError(typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Update failed.')
    } finally { setSaving(false) }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 600 }}>
        <div className="page-header">
          <h1>My Profile</h1>
        </div>
        <div className="card card-body">
          {/* Avatar + info strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(224,61,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent)', flexShrink: 0 }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{user?.username}</div>
              <div style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: 4 }}>{user?.email}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="badge" style={{ background: 'rgba(224,61,0,0.08)', color: 'var(--accent)' }}>{user?.role}</span>
                {user?.is_verified && <span className="badge badge-active">Verified</span>}
              </div>
            </div>
          </div>

          {success && <div className="alert alert-success">{success}</div>}
          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Account */}
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Account</div>

            <div className="form-row">
              <div className="form-group">
                <label>Username</label>
                <input value={form.username} onChange={set('username')} required />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="tel" value={form.phone_number} onChange={set('phone_number')} placeholder="+1 234 567 8900" />
              </div>
            </div>

            <div className="form-group">
              <label>Bio</label>
              <textarea rows={3} value={form.bio} onChange={set('bio')} placeholder="Tell buyers/sellers about yourself..." />
            </div>

            <div className="form-group">
              <label>Account Type</label>
              <div style={{ padding: '10px 14px', background: 'var(--bg3)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.95rem', color: 'var(--text2)' }}>
                {user?.role === 'seller' ? 'Seller' : 'Buyer'} <span style={{ fontSize: '0.78rem', color: 'var(--text3)', marginLeft: 6 }}>(cannot be changed)</span>
              </div>
            </div>

            {/* Address */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 16, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Shipping Address
            </div>

            <div className="form-group">
              <label>Address Line 1</label>
              <input value={form.address_line1} onChange={set('address_line1')} placeholder="123 Main Street, Apt 4" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input value={form.city} onChange={set('city')} placeholder="New York" />
              </div>
              <div className="form-group">
                <label>State / Province</label>
                <input value={form.state_province} onChange={set('state_province')} placeholder="NY" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Postal Code</label>
                <input value={form.postal_code} onChange={set('postal_code')} placeholder="10001" />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input value={form.country} onChange={set('country')} placeholder="United States" />
              </div>
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
