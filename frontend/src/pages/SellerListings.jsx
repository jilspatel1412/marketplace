import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listingAPI } from '../api'

export default function SellerListings() {
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  const fetchListings = () => {
    listingAPI.myListings().then(res => setListings(res.data.results || res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchListings() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this listing?')) return
    setDeleting(id)
    try {
      await listingAPI.delete(id)
      setListings(prev => prev.filter(l => l.id !== id))
    } finally { setDeleting(null) }
  }

  const handlePublish = async (id) => {
    try {
      await listingAPI.update(id, { status: 'active' })
      setListings(prev => prev.map(l => l.id === id ? { ...l, status: 'active' } : l))
    } catch (err) {
      alert(err.response?.data?.error || 'Could not publish listing.')
    }
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>My Listings</h1>
            <p>{listings.length} total listings</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/seller/listings/new')}>+ New Listing</button>
        </div>

        {loading ? <div className="spinner" /> : listings.length === 0 ? (
          <div className="empty-state">
            <h3>No listings yet</h3>
            <p>Create your first listing to start selling.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/seller/listings/new')}>Create Listing</button>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th><th>Price</th><th>Condition</th><th>Status</th><th>Created</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map(l => (
                    <tr key={l.id}>
                      <td>
                        <span style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }} onClick={() => navigate(`/listings/${l.id}`)}>
                          {l.title}
                        </span>
                        {l.is_auction && <span className="badge badge-auction" style={{ marginLeft: 8 }}>Auction</span>}
                      </td>
                      <td style={{ color: 'var(--accent)', fontWeight: 700 }}>${l.price}</td>
                      <td><span className={`badge badge-${l.condition}`}>{l.condition}</span></td>
                      <td><span className={`badge badge-${l.status}`}>{l.status}</span></td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(l.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {l.status === 'draft' && (
                            <button className="btn btn-success btn-sm" onClick={() => handlePublish(l.id)}>
                              Publish
                            </button>
                          )}
                          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/seller/listings/${l.id}/edit`)}>Edit</button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(l.id)}
                            disabled={deleting === l.id}
                          >
                            {deleting === l.id ? '...' : 'Delete'}
                          </button>
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
