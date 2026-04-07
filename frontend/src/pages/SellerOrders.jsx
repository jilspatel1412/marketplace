import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { orderAPI } from '../api'
import api from '../api'

async function downloadShippingLabel(orderId) {
  const res = await api.get(`/api/orders/${orderId}/shipping-label/`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `shipping-label-order-${orderId}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

function ShipModal({ order, onClose, onShipped }) {
  const [tracking, setTracking] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await orderAPI.updateStatus(order.id, { status: 'shipped', tracking_number: tracking })
      onShipped()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update status.')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Mark as Shipped</div>
        <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 16 }}>
          Order #{order.id} — <strong>{order.listing_title}</strong>
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tracking Number (optional)</label>
            <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="e.g. 1Z999AA10123456784" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Mark as Shipped'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const STATUS_COLOR = {
  pending_payment: 'var(--yellow)',
  paid: 'var(--green)',
  shipped: '#3b82f6',
  delivered: 'var(--green)',
  cancelled: 'var(--red)',
}

const ESCROW_COLOR = {
  pending: 'var(--text3)',
  held: 'var(--yellow)',
  released: 'var(--green)',
  refunded: '#3b82f6',
  disputed: 'var(--red)',
}

function formatTimeLeft(expiresAt) {
  if (!expiresAt) return null
  const diff = new Date(expiresAt) - new Date()
  if (diff <= 0) return 'Ready to release'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}

export default function SellerOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [shipOrder, setShipOrder] = useState(null)

  const load = () => orderAPI.list().then(res => setOrders(res.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>My Sales</h1>
          <p>Manage your orders and shipments</p>
        </div>

        {shipOrder && (
          <ShipModal
            order={shipOrder}
            onClose={() => setShipOrder(null)}
            onShipped={() => { setShipOrder(null); load() }}
          />
        )}

        {loading ? <div className="spinner" /> : orders.length === 0 ? (
          <div className="empty-state">
            <h3>No sales yet</h3>
            <p>Sales will appear here once buyers purchase your listings.</p>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Item</th><th>Buyer</th><th>Amount</th><th>Status</th><th>Escrow</th><th>Tracking</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate(`/orders/${o.id}`)}>#{o.id}</td>
                      <td style={{ fontWeight: 600 }}>{o.listing_title || 'Deleted listing'}</td>
                      <td>{o.buyer_username}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 700 }}>${o.total_amount}</td>
                      <td>
                        <span style={{ color: STATUS_COLOR[o.status] || 'var(--text2)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'capitalize' }}>
                          {o.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {o.escrow_status && o.escrow_status !== 'pending' ? (
                          <div>
                            <span style={{ color: ESCROW_COLOR[o.escrow_status], fontWeight: 600, textTransform: 'capitalize' }}>
                              {o.escrow_status_display || o.escrow_status}
                            </span>
                            {o.escrow_status === 'held' && o.protection_expires_at && (
                              <div style={{ color: 'var(--text3)', marginTop: 2 }}>
                                {formatTimeLeft(o.protection_expires_at)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text3)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: o.tracking_number ? 'var(--text)' : 'var(--text3)' }}>
                        {o.tracking_number || '—'}
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {o.status === 'paid' && (
                            <button className="btn btn-primary btn-sm" onClick={() => setShipOrder(o)}>
                              Mark Shipped
                            </button>
                          )}
                          {(o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered') && (
                            <button className="btn btn-secondary btn-sm"
                              onClick={() => downloadShippingLabel(o.id).catch(() => alert('Could not download label.'))}>
                              Label
                            </button>
                          )}
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
