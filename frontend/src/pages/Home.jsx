import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listingAPI, categoryAPI } from '../api'
import ListingCard from '../components/ListingCard'

const CATEGORIES = [
  { slug: 'electronics', name: 'Electronics', icon: '⚡' },
  { slug: 'clothing', name: 'Clothing', icon: '👗' },
  { slug: 'books', name: 'Books', icon: '📚' },
  { slug: 'sports', name: 'Sports', icon: '⚽' },
  { slug: 'home', name: 'Home & Garden', icon: '🏡' },
  { slug: 'vehicles', name: 'Vehicles', icon: '🚗' },
  { slug: 'music', name: 'Music', icon: '🎵' },
  { slug: 'art', name: 'Art', icon: '🎨' },
]

export default function Home() {
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    listingAPI.list({ page: 1 }).then(res => {
      setFeatured((res.data.results || res.data).slice(0, 6))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0a0a0b 0%, #1a0a00 50%, #0a0a0b 100%)',
        borderBottom: '1px solid var(--border)', padding: '80px 0 64px',
      }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,77,0,0.1)', border: '1px solid rgba(255,77,0,0.3)', borderRadius: 20, padding: '4px 16px', marginBottom: 20, fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Peer-to-peer marketplace
          </div>
          <h1 style={{ marginBottom: 16, maxWidth: 700, margin: '0 auto 16px' }}>
            No fakes.{' '}
            <span style={{ color: 'var(--accent)' }}>No fraud.</span>{' '}
            No doubt.
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '1.15rem', maxWidth: 500, margin: '0 auto 36px' }}>
            Buy and sell with confidence. Every listing verified, every transaction secured.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/listings')}>Browse Listings</button>
            <button className="btn btn-secondary btn-lg" onClick={() => navigate('/register')}>Start Selling</button>
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section style={{ padding: '56px 0' }}>
        <div className="container">
          <h2 style={{ marginBottom: 28 }}>Shop by Category</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.slug}
                className="card card-body"
                style={{ textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', padding: '20px 12px' }}
                onClick={() => navigate(`/listings?category=${cat.slug}`)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{cat.icon}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text2)', fontFamily: 'var(--font-display)' }}>{cat.name}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Listings ── */}
      <section style={{ padding: '0 0 80px' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2>Featured Listings</h2>
            <button className="btn btn-ghost" onClick={() => navigate('/listings')}>View all →</button>
          </div>
          {loading ? (
            <div className="spinner" />
          ) : featured.length === 0 ? (
            <div className="empty-state">
              <h3>No listings yet</h3>
              <p>Be the first to list something for sale.</p>
            </div>
          ) : (
            <div className="listings-grid">
              {featured.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
