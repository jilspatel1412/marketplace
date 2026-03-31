import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { orderAPI } from '../api'
import { useAuth } from '../context/AuthContext'

const STATUS_COLOR = {
  pending_payment: 'var(--yellow)',
  paid: 'var(--green)',
  shipped: '#3b82f6',
  delivered: 'var(--green)',
  cancelled: 'var(--red)',
}

const STATUS_STEPS = ['pending_payment', 'paid', 'shipped', 'delivered']

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deliverLoading, setDeliverLoading] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')

  const loadOrder = () => orderAPI.get(id).then(r => setOrder(r.data)).catch(() => {})

  useEffect(() => {
    orderAPI.get(id)
      .then(r => setOrder(r.data))
      .catch(() => navigate(user?.role === 'seller' ? '/seller/orders' : '/buyer/orders'))
      .finally(() => setLoading(false))
  }, [id])

  const handleMarkDelivered = async () => {
    setDeliverLoading(true)
    try {
      await orderAPI.updateStatus(id, { status: 'delivered' })
      loadOrder()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to mark as delivered.')
    } finally { setDeliverLoading(false) }
  }

  const handleReview = async (e) => {
    e.preventDefault()
    setReviewLoading(true); setReviewError('')
    try {
      await orderAPI.createReview(id, { rating: reviewRating, comment: reviewComment })
      loadOrder()
    } catch (err) {
      setReviewError(err.response?.data?.error || 'Could not submit review.')
    } finally { setReviewLoading(false) }
  }

  if (loading) return <div className="spinner" />
  if (!order) return null

  const isBuyer = user?.id === order.buyer
  const currentStep = STATUS_STEPS.indexOf(order.status)
  const canReview = isBuyer && !order.has_review && ['paid', 'shipped', 'delivered'].includes(order.status)

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700 }}>
        <button className="btn btn-secondary btn-sm" style={{ marginBottom: 24 }} onClick={() => navigate(-1)}>← Back</button>

        <div className="page-header">
          <h1>Order #{order.id}</h1>
          <p style={{ color: STATUS_COLOR[order.status] || 'var(--text2)', fontWeight: 600, textTransform: 'capitalize' }}>
            {order.status.replace('_', ' ')}
          </p>
        </div>

        {/* Progress tracker */}
        {order.status !== 'cancelled' && (
          <div className="card card-body" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 12, left: '10%', right: '10%', height: 2, background: 'var(--border)', zIndex: 0 }} />
              {STATUS_STEPS.map((s, i) => (
                <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 1, flex: 1 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: i <= currentStep ? 'var(--accent)' : 'var(--border)',
                    border: `2px solid ${i <= currentStep ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                  }}>
                    {i < currentStep ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: i <= currentStep ? 'var(--text)' : 'var(--text3)', textAlign: 'center', textTransform: 'capitalize', fontWeight: i === currentStep ? 700 : 400 }}>
                    {s.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order info */}
        <div className="card card-body" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>Order Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Item</div>
              <div style={{ fontWeight: 600 }}>{order.listing_title || 'Deleted listing'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Amount</div>
              <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '1.1rem' }}>${order.total_amount}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{isBuyer ? 'Seller' : 'Buyer'}</div>
              <div style={{ fontWeight: 600 }}>{isBuyer ? order.seller_username : order.buyer_username}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Date</div>
              <div>{new Date(order.created_at).toLocaleDateString()}</div>
            </div>
            {order.tracking_number && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Tracking Number</div>
                <div style={{ fontWeight: 600, color: '#3b82f6' }}>{order.tracking_number}</div>
              </div>
            )}
          </div>
        </div>

        {/* Payment info */}
        {order.payment && (
          <div className="card card-body" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12 }}>Payment</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>Status</span>
              <span style={{ fontWeight: 600, color: order.payment.status === 'succeeded' ? 'var(--green)' : 'var(--yellow)', textTransform: 'capitalize' }}>
                {order.payment.status}
              </span>
            </div>
          </div>
        )}

        {/* Leave a review */}
        {canReview && (
          <div className="card card-body" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12 }}>Leave a Review</h3>
            {reviewError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{reviewError}</div>}
            <form onSubmit={handleReview}>
              <div className="form-group">
                <label>Rating</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n} type="button"
                      onClick={() => setReviewRating(n)}
                      style={{ fontSize: '1.6rem', background: 'none', border: 'none', cursor: 'pointer', color: n <= reviewRating ? '#f59e0b' : 'var(--border)', padding: 0, lineHeight: 1 }}
                    >★</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Comment (optional)</label>
                <textarea rows={3} value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="How was your experience with this seller?" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={reviewLoading}>
                {reviewLoading ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          </div>
        )}

        {/* Existing review */}
        {order.has_review && order.review && (
          <div className="card card-body" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12 }}>Your Review</h3>
            <div style={{ color: '#f59e0b', fontSize: '1.1rem', marginBottom: 6 }}>
              {'★'.repeat(order.review.rating)}{'☆'.repeat(5 - order.review.rating)}
            </div>
            {order.review.comment && <p style={{ color: 'var(--text2)', margin: 0 }}>{order.review.comment}</p>}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {order.status === 'pending_payment' && isBuyer && (
            <button className="btn btn-primary" onClick={() => navigate(`/checkout/${order.id}`)}>Pay Now</button>
          )}
          {order.status === 'shipped' && isBuyer && (
            <button className="btn btn-success" disabled={deliverLoading} onClick={handleMarkDelivered}>
              {deliverLoading ? 'Updating...' : 'Mark as Delivered'}
            </button>
          )}
          {(order.status === 'paid' || order.status === 'shipped' || order.status === 'delivered') && (
            <a className="btn btn-secondary" href={orderAPI.shippingLabel(order.id)} target="_blank" rel="noreferrer">Download Label</a>
          )}
        </div>
      </div>
    </div>
  )
}
