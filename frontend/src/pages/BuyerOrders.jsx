import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { orderAPI } from '../api'

export default function BuyerOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    orderAPI.list().then(res => setOrders(res.data)).finally(() => setLoading(false))
  }, [])

  const statusColor = { pending_payment: 'var(--yellow)', paid: 'var(--green)', cancelled: 'var(--red)' }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>My Orders</h1>
        </div>
        {loading ? <div className="spinner" /> : orders.length === 0 ? (
          <div className="empty-state">
            <h3>No orders yet</h3>
            <p>Orders will appear here after you accept an offer or win an auction.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/listings')}>Browse Listings</button>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Item</th><th>Seller</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--text3)' }}>#{o.id}</td>
                      <td style={{ fontWeight: 600 }}>{o.listing_title || 'Deleted listing'}</td>
                      <td>{o.seller_username}</td>
                      <td style={{ color: 'var(--accent)', fontWeight: 700 }}>${o.total_amount}</td>
                      <td>
                        <span style={{ color: statusColor[o.status], fontWeight: 600, fontSize: '0.85rem' }}>
                          {o.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>
                        {o.status === 'pending_payment' && (
                          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/checkout/${o.id}`)}>
                            Pay Now
                          </button>
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
