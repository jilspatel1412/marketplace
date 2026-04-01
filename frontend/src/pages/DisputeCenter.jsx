import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { disputeAPI } from '../api'

const STATUS_LABELS = {
  open: 'Open',
  under_review: 'Under Review',
  resolved_refund: 'Resolved — Refund',
  resolved_no_refund: 'Resolved — No Refund',
  closed: 'Closed',
}

const STATUS_COLOR = {
  open: '#f59e0b',
  under_review: '#3b82f6',
  resolved_refund: 'var(--green)',
  resolved_no_refund: 'var(--text3)',
  closed: 'var(--text3)',
}

export default function DisputeCenter() {
  const navigate = useNavigate()
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    disputeAPI.list()
      .then(res => setDisputes(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Dispute Center</h1>
          <p>Track and manage order disputes</p>
        </div>

        {disputes.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚖️</div>
            <h3>No disputes</h3>
            <p>You have no open or past disputes.</p>
            <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/buyer/orders')}>
              Back to Orders
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 24 }}>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>#</th><th>Order</th><th>Reason</th><th>Status</th><th>Date</th><th></th></tr>
                  </thead>
                  <tbody>
                    {disputes.map(d => (
                      <tr key={d.id} style={{ cursor: 'pointer', background: selected?.id === d.id ? 'rgba(255,77,0,0.05)' : '' }}>
                        <td style={{ color: 'var(--text3)' }}>#{d.id}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>Order #{d.order}</span>
                          {d.order_listing && <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{d.order_listing}</div>}
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text2)', textTransform: 'capitalize' }}>
                          {d.reason.replace(/_/g, ' ')}
                        </td>
                        <td>
                          <span style={{ color: STATUS_COLOR[d.status], fontWeight: 600, fontSize: '0.82rem' }}>
                            {STATUS_LABELS[d.status] || d.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>
                          {new Date(d.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(selected?.id === d.id ? null : d)}>
                            {selected?.id === d.id ? 'Close' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selected && (
              <div className="card card-body" style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>Dispute #{selected.id}</h3>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '1.2rem' }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 2 }}>ORDER</div>
                    <div style={{ fontWeight: 600 }}>#{selected.order} — {selected.order_listing || 'Deleted listing'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 2 }}>REASON</div>
                    <div style={{ textTransform: 'capitalize' }}>{selected.reason.replace(/_/g, ' ')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 2 }}>STATUS</div>
                    <span style={{ color: STATUS_COLOR[selected.status], fontWeight: 700 }}>
                      {STATUS_LABELS[selected.status]}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 4 }}>DESCRIPTION</div>
                    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px', fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text2)' }}>
                      {selected.description}
                    </div>
                  </div>
                  {selected.resolution && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 4 }}>RESOLUTION</div>
                      <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '12px 14px', fontSize: '0.9rem', lineHeight: 1.7 }}>
                        {selected.resolution}
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                    Opened by <strong>{selected.opened_by_username}</strong> on {new Date(selected.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-secondary" onClick={() => navigate(`/orders/${selected.order}`)}>
                      View Order
                    </button>
                    {selected.status === 'open' && (
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                        onClick={async () => {
                          try {
                            await disputeAPI.update(selected.id, { status: 'closed' })
                            setDisputes(prev => prev.map(d => d.id === selected.id ? { ...d, status: 'closed' } : d))
                            setSelected({ ...selected, status: 'closed' })
                          } catch {}
                        }}
                      >
                        Close Dispute
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
