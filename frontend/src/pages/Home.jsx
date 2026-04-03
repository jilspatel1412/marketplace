import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listingAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import ListingCard from '../components/ListingCard'

function getRecentlyViewedIds() {
  try {
    return JSON.parse(localStorage.getItem('recently_viewed') || '[]')
  } catch { return [] }
}

const CATEGORIES = [
  { slug: 'electronics', name: 'Electronics', icon: '⚡' },
  { slug: 'clothing-apparel', name: 'Clothing', icon: '👗' },
  { slug: 'books-media', name: 'Books & Media', icon: '📚' },
  { slug: 'sports-outdoors', name: 'Sports', icon: '⚽' },
  { slug: 'home-garden', name: 'Home & Garden', icon: '🏡' },
  { slug: 'vehicles', name: 'Vehicles', icon: '🚗' },
  { slug: 'musical-instruments', name: 'Music', icon: '🎵' },
  { slug: 'collectibles-art', name: 'Art', icon: '🎨' },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Create a listing', desc: 'Snap photos, write a description, set your price. Takes under 2 minutes.' },
  { step: '02', title: 'Receive offers', desc: 'Buyers browse and submit offers or place bids. You stay in full control.' },
  { step: '03', title: 'Get paid securely', desc: 'Accept an offer, confirm payment via Stripe, ship or hand over the item.' },
]

export default function Home() {
  const [featured, setFeatured] = useState([])
  const [recentlyViewed, setRecentlyViewed] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSellCTA = () => {
    if (user?.role === 'seller') navigate('/seller/listings/new')
    else navigate('/register')
  }

  useEffect(() => {
    listingAPI.list({ page: 1 }).then(res => {
      setFeatured((res.data.results || res.data).slice(0, 8))
    }).catch(() => {}).finally(() => setLoading(false))

    // Load recently viewed listings from localStorage
    const ids = getRecentlyViewedIds()
    if (ids.length > 0) {
      Promise.all(ids.slice(0, 6).map(id => listingAPI.get(id).catch(() => null)))
        .then(results => setRecentlyViewed(results.filter(Boolean).map(r => r.data)))
        .catch(() => {})
    }
  }, [])

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{
        background: 'linear-gradient(160deg, #0d0d10 0%, #1f0800 60%, #0d0d10 100%)',
        padding: 'clamp(40px, 8vw, 72px) 16px clamp(36px, 6vw, 60px)',
      }}>
        <div className="container" style={{ maxWidth: 760, textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,77,0,0.12)', border: '1px solid rgba(255,77,0,0.3)',
            borderRadius: 20, padding: '4px 14px', marginBottom: 20,
            fontSize: '0.72rem', color: 'var(--accent2)', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            Peer-to-peer marketplace
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.4rem)', lineHeight: 1.12, marginBottom: 18, color: '#fff' }}>
            Buy and sell anything,<br />
            <span style={{ color: 'var(--accent2)' }}>directly.</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1.05rem', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.75 }}>
            No middlemen. No nonsense. List your item in minutes or find exactly what you're looking for.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/listings')}>Browse Listings</button>
            <button className="btn btn-outline-dark btn-lg" onClick={handleSellCTA}>Start Selling</button>
          </div>
        </div>
      </section>

      {/* ── Featured Listings ── */}
      <section style={{ padding: '52px 0 40px' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>Latest Listings</h2>
              <p style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Recently added by sellers</p>
            </div>
            <button className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => navigate('/listings')}>View all →</button>
          </div>
          {loading ? (
            <div className="spinner" />
          ) : featured.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📦</div>
              <h3>No listings yet</h3>
              <p style={{ marginBottom: 20 }}>Be the first to list something for sale.</p>
              <button className="btn btn-primary" onClick={() => navigate('/register')}>Start Selling</button>
            </div>
          ) : (
            <div className="listings-grid">
              {featured.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── Recently Viewed ── */}
      {recentlyViewed.length > 0 && (
        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
              <div>
                <h2 style={{ marginBottom: 4 }}>Recently Viewed</h2>
                <p style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Pick up where you left off</p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => { localStorage.removeItem('recently_viewed'); setRecentlyViewed([]) }}
              >
                Clear
              </button>
            </div>
            <div className="listings-grid">
              {recentlyViewed.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Sell Your Item Banner ── */}
      <section style={{ padding: '0 0 48px' }}>
        <div className="container">
          <div style={{
            background: 'linear-gradient(120deg, #1a0800 0%, #0d0d10 100%)',
            border: '1px solid rgba(255,77,0,0.25)',
            borderRadius: 16, padding: 'clamp(20px, 4vw, 36px) clamp(20px, 4vw, 40px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent2)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Got something to sell?</div>
              <h3 style={{ marginBottom: 8, fontSize: '1.4rem', color: '#fff' }}>List your item for free</h3>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', maxWidth: 380, lineHeight: 1.7 }}>
                Set your price, upload photos, and reach buyers instantly. Fixed price or auction — your choice.
              </p>
            </div>
            <button className="btn btn-primary" style={{ whiteSpace: 'nowrap', padding: '12px 28px' }} onClick={handleSellCTA}>
              {user?.role === 'seller' ? 'Create a Listing' : 'Create a Free Listing'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section style={{ padding: '0 0 56px' }}>
        <div className="container">
          <h2 style={{ marginBottom: 20 }}>Shop by Category</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.slug}
                className="card card-body category-card"
                onClick={() => navigate(`/listings?category=${cat.slug}`)}
              >
                <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>{cat.icon}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text2)', fontFamily: 'var(--font-display)' }}>{cat.name}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '52px 0' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: 36 }}>How SellIt works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            {HOW_IT_WORKS.map(item => (
              <div key={item.step} style={{ padding: '24px', background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900, color: 'rgba(255,77,0,0.2)', marginBottom: 10 }}>{item.step}</div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{item.title}</div>
                <div style={{ color: 'var(--text2)', fontSize: '0.85rem', lineHeight: 1.7 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Statement ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0a0a0b 0%, #1f0800 50%, #0a0a0b 100%)',
        padding: '80px 0',
        textAlign: 'center',
      }}>
        <div className="container" style={{ maxWidth: 640 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 18 }}>Our Promise</p>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4.5vw, 3.2rem)', fontWeight: 900, lineHeight: 1.2, marginBottom: 20, color: '#fff' }}>
            No fakes.{' '}
            <span style={{ color: 'var(--accent2)' }}>No fraud.</span>{' '}
            No doubt.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: 36 }}>
            Every seller is verified. Every transaction is protected. We take trust seriously so you don't have to think twice.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/listings')}>Start Browsing</button>
        </div>
      </section>
    </div>
  )
}
