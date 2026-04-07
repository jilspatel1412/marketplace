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

  // 2FA state
  const [show2faSetup, setShow2faSetup] = useState(false)
  const [qrData, setQrData] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [twoFaLoading, setTwoFaLoading] = useState(false)
  const [disableCode, setDisableCode] = useState('')

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
              <input value={form.address_line1} onChange={set('address_line1')} placeholder="123 Main Street, Unit 4" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input value={form.city} onChange={set('city')} placeholder="Toronto" />
              </div>
              <div className="form-group">
                <label>Province</label>
                <input value={form.state_province} onChange={set('state_province')} placeholder="Ontario" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Postal Code</label>
                <input value={form.postal_code} onChange={set('postal_code')} placeholder="M5V 3A8" />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input value={form.country} onChange={set('country')} placeholder="Canada" />
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

        {/* 2FA Section */}
        <div className="card card-body" style={{ marginTop: 24 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            Two-Factor Authentication
          </div>

          {user?.is_2fa_enabled ? (
            <div>
              <div className="alert alert-success" style={{ marginBottom: 16 }}>
                2FA is <strong>enabled</strong>. Your account is protected.
              </div>
              <div className="form-group">
                <label>Enter TOTP code to disable</label>
                <input
                  value={disableCode}
                  onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  style={{ maxWidth: 200, textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2em' }}
                />
              </div>
              <button
                className="btn btn-danger btn-sm"
                disabled={twoFaLoading || disableCode.length < 6}
                onClick={async () => {
                  setTwoFaLoading(true); setError('')
                  try {
                    await authAPI.disable2fa(disableCode)
                    await refreshUser()
                    setSuccess('2FA disabled.')
                    setDisableCode('')
                  } catch (err) {
                    setError(err.response?.data?.error || 'Failed to disable 2FA.')
                  } finally { setTwoFaLoading(false) }
                }}
              >
                {twoFaLoading ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </div>
          ) : show2faSetup && qrData ? (
            <div>
              <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 16 }}>
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
              </p>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img src={qrData.qr_code} alt="2FA QR Code" style={{ width: 200, height: 200, imageRendering: 'pixelated' }} />
              </div>
              <div style={{ background: 'var(--bg3)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: '0.8rem', color: 'var(--text2)', marginBottom: 16, wordBreak: 'break-all' }}>
                <strong>Manual key:</strong> {qrData.secret}
              </div>
              <div className="form-group">
                <label>Enter the 6-digit code from your app</label>
                <input
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  style={{ maxWidth: 200, textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2em' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={twoFaLoading || totpCode.length < 6}
                  onClick={async () => {
                    setTwoFaLoading(true); setError('')
                    try {
                      await authAPI.verify2fa(totpCode)
                      await refreshUser()
                      setSuccess('2FA enabled successfully!')
                      setShow2faSetup(false); setQrData(null); setTotpCode('')
                    } catch (err) {
                      setError(err.response?.data?.error || 'Invalid code.')
                    } finally { setTwoFaLoading(false) }
                  }}
                >
                  {twoFaLoading ? 'Verifying...' : 'Verify & Enable'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShow2faSetup(false); setQrData(null); setTotpCode('') }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 16 }}>
                Add an extra layer of security to your account with a time-based one-time password (TOTP).
              </p>
              <button
                className="btn btn-secondary btn-sm"
                disabled={twoFaLoading}
                onClick={async () => {
                  setTwoFaLoading(true); setError('')
                  try {
                    const res = await authAPI.setup2fa()
                    setQrData(res.data)
                    setShow2faSetup(true)
                  } catch (err) {
                    setError(err.response?.data?.error || 'Failed to setup 2FA.')
                  } finally { setTwoFaLoading(false) }
                }}
              >
                {twoFaLoading ? 'Loading...' : 'Enable 2FA'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
