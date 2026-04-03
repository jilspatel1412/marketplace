import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminAPI, disputeAPI } from '../api'

const DISPUTE_STATUS_LABELS = {
  open: 'Open',
  under_review: 'Under Review',
  resolved_refund: 'Resolved (Refund)',
  resolved_no_refund: 'Resolved (No Refund)',
  closed: 'Closed',
}

const DISPUTE_STATUS_COLOR = {
  open: '#f59e0b',
  under_review: '#3b82f6',
  resolved_refund: 'var(--green)',
  resolved_no_refund: 'var(--text3)',
  closed: 'var(--text3)',
}

export default function SupportPanel() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('disputes')
  const [stats, setStats] = useState(null)
  const [disputes, setDisputes] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [resolution, setResolution] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      adminAPI.stats(),
      disputeAPI.list(),
      adminAPI.reports(),
    ]).then(([statsRes, disputesRes, reportsRes]) => {
      setStats(statsRes.data)
      setDisputes(disputesRes.data)
      setReports(reportsRes.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleUpdateDispute = async (disputeId, newStatus) => {
    setUpdating(true)
    try {
      const payload = { status: newStatus }
      if (resolution.trim()) payload.resolution = resolution.trim()
      const res = await disputeAPI.update(disputeId, payload)
      setDisputes(prev => prev.map(d => d.id === disputeId ? res.data : d))
      if (selected?.id === disputeId) setSelected(res.data)
      setResolution('')
    } catch {}
    setUpdating(false)
  }

  const handleDismissReport = async (reportId) => {
    try {
      await adminAPI.deleteReport(reportId)
      setReports(prev => prev.filter(r => r.id !== reportId))
      setStats(prev => prev ? { ...prev, open_reports: Math.max(0, prev.open_reports - 1) } : prev)
    } catch {}
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Support Panel</h1>
          <p>Manage disputes, reports, and user issues</p>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 32 }}>
            {[
              { label: 'Open Disputes', value: stats.open_disputes, color: '#f59e0b' },
              { label: 'Total Disputes', value: stats.total_disputes, color: 'var(--text2)' },
              { label: 'Reports', value: stats.open_reports, color: '#ef4444' },
              { label: 'Orders', value: stats.total_orders, color: 'var(--accent)' },
              { label: 'Users', value: stats.total_users, color: '#3b82f6' },
              { label: 'Active Listings', value: stats.total_listings, color: 'var(--green)' },
            ].map(s => (
              <div key={s.label} className="card card-body" style={{ textAlign: 'center', padding: '16px 12px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button
            className={`btn btn-sm ${tab === 'disputes' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setTab('disputes'); setSelected(null) }}
          >
            Disputes ({disputes.filter(d => d.status === 'open' || d.status === 'under_review').length})
          </button>
          <button
            className={`btn btn-sm ${tab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setTab('reports'); setSelected(null) }}
          >
            Reports ({reports.length})
          </button>
        </div>

        {/* Disputes Tab */}
        {tab === 'disputes' && (
          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 24 }}>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>#</th><th>Order</th><th>Opened By</th><th>Reason</th><th>Status</th><th>Date</th><th></th></tr>
                  </thead>
                  <tbody>
                    {disputes.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No disputes</td></tr>
                    ) : disputes.map(d => (
                      <tr key={d.id} style={{ background: selected?.id === d.id ? 'rgba(255,77,0,0.05)' : '' }}>
                        <td style={{ color: 'var(--text3)' }}>#{d.id}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>Order #{d.order}</span>
                          {d.order_listing && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{d.order_listing}</div>}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{d.opened_by_username}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text2)', textTransform: 'capitalize' }}>
                          {d.reason.replace(/_/g, ' ')}
                        </td>
                        <td>
                          <span style={{ color: DISPUTE_STATUS_COLOR[d.status], fontWeight: 600, fontSize: '0.82rem' }}>
                            {DISPUTE_STATUS_LABELS[d.status] || d.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(d.created_at).toLocaleDateString()}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(selected?.id === d.id ? null : d)}>
                            {selected?.id === d.id ? 'Close' : 'Manage'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dispute Detail Panel */}
            {selected && (
              <div className="card card-body" style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>Dispute #{selected.id}</h3>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '1.2rem' }}>x</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase' }}>Order</div>
                    <div style={{ fontWeight: 600 }}>#{selected.order} — {selected.order_listing || 'Deleted listing'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase' }}>Opened By</div>
                    <div>{selected.opened_by_username}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase' }}>Reason</div>
                    <div style={{ textTransform: 'capitalize' }}>{selected.reason.replace(/_/g, ' ')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase' }}>Status</div>
                    <span style={{ color: DISPUTE_STATUS_COLOR[selected.status], fontWeight: 700 }}>
                      {DISPUTE_STATUS_LABELS[selected.status]}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase' }}>Description</div>
                    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text2)' }}>
                      {selected.description}
                    </div>
                  </div>

                  {selected.resolution && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase' }}>Resolution</div>
                      <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: '0.88rem', lineHeight: 1.7 }}>
                        {selected.resolution}
                      </div>
                    </div>
                  )}

                  {/* Admin Actions */}
                  {selected.status !== 'closed' && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase' }}>Resolution Note</div>
                      <textarea
                        rows={3}
                        value={resolution}
                        onChange={e => setResolution(e.target.value)}
                        placeholder="Add a note about the resolution..."
                        style={{ marginBottom: 12, width: '100%' }}
                      />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selected.status === 'open' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}
                            disabled={updating} onClick={() => handleUpdateDispute(selected.id, 'under_review')}>
                            Mark Under Review
                          </button>
                        )}
                        <button className="btn btn-sm" style={{ background: 'rgba(74,222,128,0.1)', color: '#22c55e', border: '1px solid rgba(74,222,128,0.2)' }}
                          disabled={updating} onClick={() => handleUpdateDispute(selected.id, 'resolved_refund')}>
                          Resolve (Refund)
                        </button>
                        <button className="btn btn-sm" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                          disabled={updating} onClick={() => handleUpdateDispute(selected.id, 'resolved_no_refund')}>
                          Resolve (No Refund)
                        </button>
                        <button className="btn btn-sm" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                          disabled={updating} onClick={() => handleUpdateDispute(selected.id, 'closed')}>
                          Close
                        </button>
                      </div>
                    </div>
                  )}

                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate(`/orders/${selected.order}`)}>
                    View Order
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {tab === 'reports' && (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Listing</th><th>Seller</th><th>Reported By</th><th>Reason</th><th>Detail</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No reports</td></tr>
                  ) : reports.map(r => (
                    <tr key={r.id}>
                      <td>
                        <span style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate(`/listings/${r.listing_id}`)}>
                          {r.listing_title}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{r.seller_username}</td>
                      <td style={{ fontSize: '0.85rem' }}>{r.reporter_username}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>{r.reason_display}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.detail || '—'}
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/listings/${r.listing_id}`)}>View</button>
                          <button className="btn btn-sm" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                            onClick={() => handleDismissReport(r.id)}>
                            Dismiss
                          </button>
                        </div>
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
