import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { userAPI } from '../api'
import ListingCard from '../components/ListingCard'

function Stars({ rating }) {
  if (!rating) return null
  const full = Math.round(rating)
  return (
    <span style={{ color: '#f59e0b', fontSize: '1rem' }}>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
    </span>
  )
}

export default function SellerProfile() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [blocking, setBlocking] = useState(false)

  useEffect(() => {
    setLoading(true)
    userAPI.sellerProfile(username)
      .then(res => setData(res.data))
      .catch(() => navigate('/listings'))
      .finally(() => setLoading(false))
  }, [username])

  const handleBlock = async () => {
    if (!data) return
    setBlocking(true)
    try {
      await userAPI.block(data.id)
      alert(`${data.username} has been blocked.`)
    } catch (err) {
      alert(err.response?.data?.error || 'Could not block user.')
    } finally { setBlocking(false) }
  }

  if (loading) return <div className="spinner" />
  if (!data) return null

  return (
    <div className="page">
      <div className="container">
        {/* Seller header */}
        <div className="card card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(224,61,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent)', flexShrink: 0 }}>
            {data.username[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.5rem', marginBottom: 0 }}>{data.username}</h1>
              {data.is_verified && <span className="badge badge-active">Verified</span>}
              {currentUser && currentUser.id !== data.id && (
                <button className="btn btn-sm" onClick={handleBlock} disabled={blocking}
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.72rem' }}>
                  {blocking ? '...' : 'Block'}
                </button>
              )}
            </div>
            {data.avg_rating ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                <Stars rating={data.avg_rating} />
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{data.avg_rating}</span>
                <span style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>({data.review_count} review{data.review_count !== 1 ? 's' : ''})</span>
              </div>
            ) : (
              <div style={{ color: 'var(--text3)', fontSize: '0.85rem', margin: '6px 0' }}>No reviews yet</div>
            )}
            {data.bio && <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginTop: 4 }}>{data.bio}</p>}
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 6 }}>
              Member since {new Date(data.date_joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Active listings */}
        <h2 style={{ marginBottom: 20 }}>Listings by {data.username}</h2>
        {data.listings.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: 40 }}>
            <p>No active listings right now.</p>
          </div>
        ) : (
          <div className="listings-grid" style={{ marginBottom: 48 }}>
            {data.listings.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}

        {/* Reviews */}
        {data.reviews.length > 0 && (
          <>
            <h2 style={{ marginBottom: 20 }}>Reviews</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.reviews.map(r => (
                <div key={r.id} className="card card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.reviewer_username}</span>
                      <span style={{ color: '#f59e0b', marginLeft: 10 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {r.comment && <p style={{ color: 'var(--text2)', fontSize: '0.88rem', margin: 0 }}>{r.comment}</p>}
                  {r.images && r.images.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {r.images.map(img => (
                        <img key={img.id} src={img.image_url} alt="Review"
                          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
