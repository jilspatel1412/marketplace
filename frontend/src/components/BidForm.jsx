import { useState } from 'react'
import { bidAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function BidForm({ listing, onBidPlaced }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const minBid = listing.current_bid
    ? parseFloat(listing.current_bid) + 0.01
    : parseFloat(listing.price) + 0.01

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    if (user.role !== 'buyer') { setError('Only buyers can bid.'); return }
    setError(''); setSuccess(''); setLoading(true)
    try {
      await bidAPI.place(listing.id, amount)
      setSuccess(`Bid of $${amount} placed!`)
      setAmount('')
      if (onBidPlaced) onBidPlaced()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to place bid.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card card-body" style={{ marginTop: 16 }}>
      <h4 style={{ marginBottom: 4 }}>Place a Bid</h4>
      <p style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: 12 }}>
        Minimum bid: <strong style={{ color: 'var(--accent)' }}>${minBid.toFixed(2)}</strong>
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Your Bid ($)</label>
          <input
            type="number" min={minBid} step="0.01"
            value={amount} onChange={e => setAmount(e.target.value)}
            placeholder={`$${minBid.toFixed(2)} or more`}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Placing Bid...' : 'Place Bid'}
        </button>
      </form>
    </div>
  )
}
