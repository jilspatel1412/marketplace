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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await orderAPI.createReview(order.id, { rating, comment })
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

export default function BuyerOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewOrder, setReviewOrder] = useState(null)

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

  const STATUS_COLOR = {
    pending_payment: 'var(--yellow)',
    paid: 'var(--green)',
    shipped: '#3b82f6',
    delivered: 'var(--green)',
    cancelled: 'var(--red)',
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>My Orders</h1>
        </div>

        {reviewOrder && (
          <ReviewModal
            order={reviewOrder}
            onClose={() => setReviewOrder(null)}
            onSubmit={() => { setReviewOrder(null); load() }}
          />
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
                  <tr><th>#</th><th>Item</th><th>Seller</th><th>Amount</th><th>Status</th><th>Tracking</th><th>Date</th><th></th></tr>
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
