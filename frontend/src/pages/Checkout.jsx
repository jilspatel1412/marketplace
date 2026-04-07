import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { orderAPI, paymentAPI } from '../api'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder')

const CARD_STYLE = {
  style: {
    base: {
      color: '#0c0c0e',
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      '::placeholder': { color: '#9898a8' },
    },
    invalid: { color: '#cc2200' },
  }
}

function CheckoutForm({ order, clientSecret }) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handlePay = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setError(''); setLoading(true)

    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) }
      })

      if (result.error) {
        setError(result.error.message)
      } else if (result.paymentIntent.status === 'succeeded') {
        setSuccess(true)
        setTimeout(() => navigate('/buyer/orders'), 3000)
      }
    } catch {
      setError('Payment failed. Please try again.')
    } finally {
      if (!success) setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🎉</div>
        <h2>Payment Successful!</h2>
        <p style={{ color: 'var(--text2)', marginTop: 8 }}>Your order is confirmed. Redirecting...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handlePay}>
      <div className="form-group">
        <label>Card Details</label>
        <div style={{ padding: '12px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <CardElement options={CARD_STYLE} />
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 6 }}>
          Your card details are processed securely by Stripe.
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary btn-lg" type="submit" disabled={!stripe || loading} style={{ width: '100%' }}>
        {loading ? 'Processing...' : `Pay $${order.total_amount}`}
      </button>
    </form>
  )
}

export default function Checkout() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [clientSecret, setClientSecret] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    orderAPI.get(orderId).then(res => {
      const o = res.data
      setOrder(o)
      if (o.status === 'paid') { navigate('/buyer/orders'); return }
      return paymentAPI.createIntent(orderId)
    }).then(res => {
      if (res) setClientSecret(res.data.client_secret)
    }).catch(err => {
      setError(err.response?.data?.error || 'Failed to load checkout.')
    }).finally(() => setLoading(false))
  }, [orderId])

  if (loading) return <div className="spinner" />

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div className="page-header" style={{ textAlign: 'center' }}>
          <h1>Complete Purchase</h1>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {order && (
          <div className="card card-body" style={{ marginBottom: 20 }}>
            <h4 style={{ marginBottom: 12 }}>Order Summary</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text2)' }}>Item</span>
              <span style={{ fontWeight: 600 }}>{order.listing_title || `Order #${order.id}`}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 6 }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)' }}>${order.total_amount}</span>
            </div>
          </div>
        )}

        <div className="alert alert-info" style={{ fontSize: '0.85rem' }}>
          <strong>Buyer Protection:</strong> Your payment is held in escrow until you confirm delivery. You have 7 days after delivery to open a dispute if there's an issue.
        </div>

        <div className="card card-body">
          {clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm order={order} clientSecret={clientSecret} />
            </Elements>
          )}
          {!clientSecret && !error && <div className="spinner" />}
        </div>
      </div>
    </div>
  )
}
