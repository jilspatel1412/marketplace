import { useState } from 'react'
import { offerAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function OfferForm({ listing, onOfferSubmitted }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    if (user.role !== 'buyer') { setError('Only buyers can submit offers.'); return }
    setError(''); setSuccess(''); setLoading(true)
    try {
      await offerAPI.create(listing.id, { offer_price: price })
      setSuccess('Offer submitted! The seller will be notified.')
      setPrice('')
      if (onOfferSubmitted) onOfferSubmitted()
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.offer_price?.[0] || 'Failed to submit offer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card card-body" style={{ marginTop: 16 }}>
      <h4 style={{ marginBottom: 12 }}>Make an Offer</h4>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {!success && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Your Offer Price ($)</label>
            <input
              type="number" min="0.01" step="0.01"
              value={price} onChange={e => setPrice(e.target.value)}
              placeholder={`Listing price: $${listing.price}`}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Submitting...' : 'Submit Offer'}
          </button>
        </form>
      )}
    </div>
  )
}
