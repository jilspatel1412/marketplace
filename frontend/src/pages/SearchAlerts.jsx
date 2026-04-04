import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchAlertAPI } from '../api'

export default function SearchAlerts() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    searchAlertAPI.list()
      .then(res => setAlerts(res.data))
      .catch(() => setError('Could not load alerts.'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id) => {
    try {
      await searchAlertAPI.delete(id)
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch { setError('Failed to delete alert.') }
  }

  const handleToggle = async (alert) => {
    try {
      await searchAlertAPI.toggle(alert.id, !alert.is_active)
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_active: !a.is_active } : a))
    } catch { setError('Failed to update alert.') }
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Search Alerts</h1>
            <p>Get notified when new listings match your saved searches</p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/listings')}>
            + Save New Search
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        {alerts.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔔</div>
            <h3>No search alerts</h3>
            <p>Browse listings and click "Save this search" to get notified of new matches.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/listings')}>
              Browse Listings
            </button>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Alert Label</th><th>Filters</th><th>Status</th><th>Created</th><th></th></tr>
                </thead>
                <tbody>
                  {alerts.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.label}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {a.query && <span style={{ background: 'var(--bg3)', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem' }}>"{a.query}"</span>}
                          {a.category && <span style={{ background: 'var(--bg3)', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem' }}>{a.category}</span>}
                          {a.condition && <span style={{ background: 'var(--bg3)', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem' }}>{a.condition}</span>}
                          {a.max_price && <span style={{ background: 'var(--bg3)', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem' }}>Max ${a.max_price}</span>}
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggle(a)}
                          style={{
                            background: a.is_active ? 'rgba(74,222,128,0.1)' : 'var(--bg3)',
                            color: a.is_active ? 'var(--green)' : 'var(--text3)',
                            border: `1px solid ${a.is_active ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
                            borderRadius: 20, padding: '3px 12px', cursor: 'pointer',
                            fontSize: '0.78rem', fontWeight: 600,
                          }}
                        >
                          {a.is_active ? 'Active' : 'Paused'}
                        </button>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>
                        {new Date(a.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
