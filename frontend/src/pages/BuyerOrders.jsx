import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { orderAPI, disputeAPI } from '../api'
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

function StarPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, fontSize: '1.4rem' }}>
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onClick={() => onChange(s)}
          style={{ background: 'none', fontSize: '1.4rem', color: s <= value ? '#f59e0b' : 'var(--border)', transition: 'color 0.1s', padding: 2 }}>
          ★
        </button>
      ))}
    </div>
  )
}

function ReviewModal({ order, onClose, onSubmit }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const formData = new FormData()
      formData.append('rating', rating)
      formData.append('comment', comment)
      images.forEach(img => formData.append('images', img))
      await api.post(`/api/orders/${order.id}/review/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onSubmit()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit review.')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Review your purchase</div>
        <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 16 }}>
          Rating for <strong>{order.listing_title}</strong> from <strong>{order.seller_username}</strong>
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Your Rating</label>
            <StarPicker value={rating} onChange={setRating} />
          </div>
          <div className="form-group">
            <label>Comment (optional)</label>
            <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Share your experience..." />
          </div>
          <div className="form-group">
            <label>Photos (up to 3)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={e => setImages([...e.target.files].slice(0, 3))}
              style={{ fontSize: '0.85rem' }}
            />
            {images.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text3)', marginTop: 4 }}>
                {images.length} photo{images.length > 1 ? 's' : ''} selected
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DISPUTE_REASONS = [
  { value: 'item_not_received', label: 'Item Not Received' },
  { value: 'item_not_as_described', label: 'Item Not as Described' },
  { value: 'damaged', label: 'Item Arrived Damaged' },
  { value: 'wrong_item', label: 'Wrong Item Sent' },
  { value: 'other', label: 'Other' },
]

function DisputeModal({ order, onClose, onSubmit }) {
  const [reason, setReason] = useState('item_not_received')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!description.trim()) { setError('Please describe the issue.'); return }
    setLoading(true); setError('')
    try {
      await disputeAPI.create({ order: order.id, reason, description })
      onSubmit()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not open dispute.')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Open a Dispute</div>
        <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 16 }}>
          Order #{order.id} — <strong>{order.listing_title}</strong>
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)}>
              {DISPUTE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Describe the issue *</label>
            <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Explain what happened in detail..." required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? 'Submitting...' : 'Open Dispute'}
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
  if (diff <= 0) return 'Expired'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hours}h left`
  return `${hours}h left`
}

export default function BuyerOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewOrder, setReviewOrder] = useState(null)
  const [disputeOrder, setDisputeOrder] = useState(null)
  const [disputeMsg, setDisputeMsg] = useState('')

  const load = () => orderAPI.list().then(res => setOrders(res.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleMarkDelivered = async (orderId) => {
    try {
      await orderAPI.updateStatus(orderId, { status: 'delivered' })
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o))
    } catch (err) {
      alert(err.response?.data?.error || 'Could not update status.')
    }
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>My Orders</h1>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/disputes')}>
            View Disputes
          </button>
        </div>

        {reviewOrder && (
          <ReviewModal
            order={reviewOrder}
            onClose={() => setReviewOrder(null)}
            onSubmit={() => { setReviewOrder(null); load() }}
          />
        )}
        {disputeOrder && (
          <DisputeModal
            order={disputeOrder}
            onClose={() => setDisputeOrder(null)}
            onSubmit={() => {
              setDisputeOrder(null)
              setDisputeMsg('Dispute opened. We\'ll look into this and get back to you.')
            }}
          />
        )}
        {disputeMsg && (
          <div className="alert alert-success" style={{ marginBottom: 20 }}>
            {disputeMsg}
            <button onClick={() => setDisputeMsg('')} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
          </div>
        )}

        {loading ? <div className="spinner" /> : orders.length === 0 ? (
          <div className="empty-state">
            <h3>No orders yet</h3>
            <p>Orders will appear here once you purchase something.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/listings')}>Browse Listings</button>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Item</th><th>Seller</th><th>Amount</th><th>Status</th><th>Protection</th><th>Tracking</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate(`/orders/${o.id}`)}>#{o.id}</td>
                      <td style={{ fontWeight: 600 }}>{o.listing_title || 'Deleted listing'}</td>
                      <td>{o.seller_username}</td>
                      <td style={{ color: 'var(--accent)', fontWeight: 700 }}>${o.total_amount}</td>
                      <td>
                        <span style={{ color: STATUS_COLOR[o.status] || 'var(--text2)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'capitalize' }}>
                          {o.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {o.escrow_status && o.escrow_status !== 'pending' && (
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
                        )}
                        {(!o.escrow_status || o.escrow_status === 'pending') && (
                          <span style={{ color: 'var(--text3)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: o.tracking_number ? 'var(--text)' : 'var(--text3)' }}>
                        {o.tracking_number || '—'}
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {o.status === 'pending_payment' && (
                            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/checkout/${o.id}`)}>Pay Now</button>
                          )}
                          {(o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered') && (
                            <button className="btn btn-secondary btn-sm"
                              onClick={() => downloadShippingLabel(o.id).catch(() => alert('Could not download label.'))}>
                              Label
                            </button>
                          )}
                          {o.status === 'shipped' && (
                            <button className="btn btn-success btn-sm" onClick={() => handleMarkDelivered(o.id)}>
                              Mark Delivered
                            </button>
                          )}
                          {(o.status === 'delivered' || o.status === 'paid') && !o.has_review && (
                            <button className="btn btn-secondary btn-sm" onClick={() => setReviewOrder(o)}>
                              ★ Review
                            </button>
                          )}
                          {o.has_review && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--green)' }}>✓ Reviewed</span>
                          )}
                          {['paid', 'shipped', 'delivered'].includes(o.status) && (
                            <button
                              className="btn btn-sm"
                              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.75rem' }}
                              onClick={() => setDisputeOrder(o)}
                            >
                              Dispute
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
