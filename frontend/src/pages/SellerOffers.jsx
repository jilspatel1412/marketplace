import { useState, useEffect } from 'react'
import { offerAPI } from '../api'

export default function SellerOffers() {
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const [message, setMessage] = useState('')

  const fetchOffers = () => {
    offerAPI.myOffers().then(res => setOffers(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchOffers() }, [])

  const handleRespond = async (offerId, newStatus) => {
    setActing(offerId)
    try {
      const res = await offerAPI.update(offerId, { status: newStatus })
      setMessage(newStatus === 'ACCEPTED' ? 'Offer accepted! The buyer has been notified to complete payment.' : 'Offer rejected.')
      fetchOffers()
    } catch (err) {
      setMessage(err.response?.data?.error || 'Action failed.')
    } finally { setActing(null) }
  }

  const statusColor = { PENDING: 'var(--yellow)', ACCEPTED: 'var(--green)', REJECTED: 'var(--red)', WITHDRAWN: 'var(--text3)' }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Incoming Offers</h1>
          <p>{offers.filter(o => o.status === 'PENDING').length} pending</p>
        </div>

        {message && <div className="alert alert-info" style={{ marginBottom: 20 }}>{message}</div>}

        {loading ? <div className="spinner" /> : offers.length === 0 ? (
          <div className="empty-state">
            <h3>No offers yet</h3>
            <p>Offers on your negotiable listings will appear here.</p>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Listing</th><th>Buyer</th><th>Offer Price</th><th>Status</th><th>Date</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {offers.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600 }}>{o.listing_title}</td>
                      <td>{o.buyer_username}</td>
                      <td style={{ color: 'var(--accent)', fontWeight: 700 }}>${o.offer_price}</td>
                      <td>
                        <span style={{ color: statusColor[o.status], fontWeight: 600, fontSize: '0.85rem' }}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>
                        {o.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleRespond(o.id, 'ACCEPTED')}
                              disabled={acting === o.id}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRespond(o.id, 'REJECTED')}
                              disabled={acting === o.id}
                            >
                              Reject
                            </button>
                          </div>
                        )}
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
