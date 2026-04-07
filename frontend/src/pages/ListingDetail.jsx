import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listingAPI, bidAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import ImageGallery from '../components/ImageGallery'
import Countdown from '../components/Countdown'
import OfferForm from '../components/OfferForm'
import BidForm from '../components/BidForm'
import ListingCard from '../components/ListingCard'

const REPORT_REASONS = [
  { value: 'fake', label: 'Fake or counterfeit item' },
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'sold', label: 'Already sold / unavailable' },
  { value: 'other', label: 'Other' },
]

function ReportModal({ listingId, onClose }) {
  const [reason, setReason] = useState('fake')
  const [detail, setDetail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await listingAPI.report(listingId, { reason, detail })
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit report.')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Report Listing</div>
        {done ? (
          <div>
            <div className="alert alert-success">Thanks for letting us know. We'll look into it.</div>
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label>Reason</label>
              <select value={reason} onChange={e => setReason(e.target.value)}>
                {REPORT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Additional details (optional)</label>
              <textarea rows={3} value={detail} onChange={e => setDetail(e.target.value)} placeholder="Provide any extra context..." />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-danger" disabled={loading}>{loading ? 'Submitting...' : 'Submit Report'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
export default function ListingDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [listing, setListing] = useState(null)
  const [related, setRelated] = useState([])
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [auctionEnded, setAuctionEnded] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [contactMsg, setContactMsg] = useState('')
  const [contactSent, setContactSent] = useState(false)
  const [contactLoading, setContactLoading] = useState(false)
  const [contactError, setContactError] = useState('')
  const [buyLoading, setBuyLoading] = useState(false)
  const [buyError, setBuyError] = useState('')
  const [acceptBidLoading, setAcceptBidLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)

  const fetchListing = useCallback(() => {
    listingAPI.get(id).then(res => {
      setListing(res.data)
      setIsFavorited(res.data.is_favorited || false)
      if (res.data.auction_end_time) {
        setAuctionEnded(new Date(res.data.auction_end_time) < new Date())
      }
    }).catch(() => navigate('/listings'))
  }, [id, navigate])

  const handleAuctionExpire = useCallback(() => {
    setAuctionEnded(true)
    fetchListing()
  }, [fetchListing])

  useEffect(() => {
    setLoading(true)
    listingAPI.get(id).then(listRes => {
      setListing(listRes.data)
      setIsFavorited(listRes.data.is_favorited || false)
      if (listRes.data.auction_end_time) {
        setAuctionEnded(new Date(listRes.data.auction_end_time) < new Date())
      }
      try {
        const prev = JSON.parse(localStorage.getItem('recently_viewed') || '[]')
        const updated = [Number(id), ...prev.filter(i => i !== Number(id))].slice(0, 12)
        localStorage.setItem('recently_viewed', JSON.stringify(updated))
      } catch {}
      // Load related and bids independently — don't crash page if these fail
      listingAPI.related(id).then(r => setRelated(r.data)).catch(() => {})
      bidAPI.list(id).then(r => setBids(r.data)).catch(() => {})
    }).catch(() => navigate('/listings')).finally(() => setLoading(false))
  }, [id])

  const toggleFavorite = async () => {
    if (!user) { navigate('/login'); return }
    setFavLoading(true)
    try {
      if (isFavorited) {
        await listingAPI.unfavorite(id)
        setIsFavorited(false)
      } else {
        await listingAPI.favorite(id)
        setIsFavorited(true)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setFavLoading(false)
    }
  }

  const handleContact = async () => {
    if (!contactMsg.trim()) return
    setContactError('')
    setContactLoading(true)
    try {
      await listingAPI.contact(id, { message: contactMsg })
      setContactSent(true)
      setContactMsg('')
    } catch (err) {
      setContactError(err.response?.data?.error || 'Failed to send message.')
    } finally {
      setContactLoading(false)
    }
  }

  const closeContact = () => {
    setShowContact(false)
    setContactSent(false)
    setContactMsg('')
    setContactError('')
  }

  const handleBuyNow = async () => {
    if (!user) { navigate('/login'); return }
    setBuyError(''); setBuyLoading(true)
    try {
      const res = await listingAPI.buyNow(id)
      navigate(`/checkout/${res.data.order_id}`)
    } catch (err) {
      setBuyError(err.response?.data?.error || 'Could not process purchase.')
    } finally { setBuyLoading(false) }
  }

  const handleAcceptBid = async () => {
    if (!window.confirm('Accept the current highest bid and close the auction?')) return
    setAcceptBidLoading(true)
    try {
      const res = await listingAPI.acceptBid(id)
      alert(`Bid accepted! Winner: ${res.data.winner} — $${res.data.amount}. Buyer notified.`)
      fetchListing()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to accept bid.')
    } finally { setAcceptBidLoading(false) }
  }

  if (loading) return <div className="spinner" />
  if (!listing) return null

  const isSeller = user && listing.seller_info?.id === user.id
  const conditionClass = { new: 'badge-new', used: 'badge-used', refurbished: 'badge-refurbished' }[listing.condition]

  return (
    <div className="page">
      <div className="container">
        <div className="listing-detail-grid">
          {/* Left: Images + Details */}
          <div>
            <ImageGallery images={listing.images} />
            <div style={{ marginTop: 32 }}>
              <h1 style={{ marginBottom: 12 }}>{listing.title}</h1>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <span className={`badge ${conditionClass}`}>{listing.condition}</span>
                <span className={`badge badge-${listing.status}`}>{listing.status}</span>
                {listing.is_auction && <span className="badge badge-auction">Auction</span>}
                {listing.is_negotiable && <span className="badge" style={{ background: 'rgba(255,196,71,0.15)', color: 'var(--yellow)' }}>Negotiable</span>}
              </div>
              <p style={{ color: 'var(--text2)', lineHeight: 1.8 }}>{listing.description}</p>
              {listing.category_detail && (
                <p style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--text3)' }}>
                  Category: <span style={{ color: 'var(--text2)' }}>{listing.category_detail.name}</span>
                </p>
              )}
            </div>

            {/* Bid History */}
            {listing.is_auction && bids.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h3 style={{ marginBottom: 16 }}>Bid History ({bids.length})</h3>
                <div className="card">
                  <table>
                    <thead><tr><th>Bidder</th><th>Amount</th><th>Time</th></tr></thead>
                    <tbody>
                      {bids.map(b => (
                        <tr key={b.id}>
                          <td>{b.bidder_username}</td>
                          <td style={{ color: 'var(--accent)', fontWeight: 700 }}>${b.amount}</td>
                          <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(b.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Related Items */}
            {related.length > 0 && (
              <div style={{ marginTop: 48 }}>
                <h3 style={{ marginBottom: 20 }}>Related Items</h3>
                <div className="listings-grid">
                  {related.map(l => <ListingCard key={l.id} listing={l} />)}
                </div>
              </div>
            )}
          </div>

          {/* Right: Price + Actions */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div className="card card-body">
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  {listing.is_auction ? 'Current Bid' : 'Price'}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent)' }}>
                  ${listing.is_auction ? (listing.current_bid || listing.price) : listing.price}
                </div>
              </div>

              {listing.is_auction && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    {auctionEnded ? 'Ended' : 'Time Remaining'}
                  </div>
                  {auctionEnded ? (
                    <span className="badge badge-sold">Auction Ended</span>
                  ) : (
                    <Countdown
                      endTime={listing.auction_end_time}
                      onExpire={handleAuctionExpire}
                    />
                  )}
                </div>
              )}

              <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', marginBottom: 16 }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 4 }}>Seller</div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    style={{ cursor: 'pointer', color: 'var(--accent)' }}
                    onClick={() => navigate(`/sellers/${listing.seller_info?.username}`)}
                  >
                    {listing.seller_info?.username}
                  </span>
                  {listing.seller_info?.is_verified && <span style={{ color: 'var(--green)', fontSize: '0.75rem' }}>✓ Verified</span>}
                  {listing.seller_info?.is_verified_seller && (
                    <span style={{
                      background: 'rgba(255,196,0,0.15)', color: '#f59e0b',
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px',
                      borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)',
                      letterSpacing: '0.04em',
                    }}>★ VERIFIED SELLER</span>
                  )}
                </div>
                {listing.seller_info?.avg_rating ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <span style={{ color: '#f59e0b', fontSize: '0.9rem' }}>
                      {'★'.repeat(Math.round(listing.seller_info.avg_rating))}{'☆'.repeat(5 - Math.round(listing.seller_info.avg_rating))}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                      {listing.seller_info.avg_rating} ({listing.seller_info.review_count})
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 4 }}>No reviews yet</div>
                )}
                {listing.watcher_count > 0 && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 6 }}>
                    👁 {listing.watcher_count} {listing.watcher_count === 1 ? 'person watching' : 'people watching'}
                  </div>
                )}
              </div>

              {/* Seller actions */}
              {isSeller && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => navigate(`/seller/listings/${listing.id}/edit`)}>Edit Listing</button>
                  {listing.is_auction && listing.status === 'active' && bids.length > 0 && (
                    <button
                      className="btn btn-success"
                      style={{ width: '100%' }}
                      disabled={acceptBidLoading}
                      onClick={handleAcceptBid}
                    >
                      {acceptBidLoading ? 'Processing...' : `Accept Current Bid ($${listing.current_bid})`}
                    </button>
                  )}
                </div>
              )}

              {/* Buyer actions */}
              {!isSeller && listing.status === 'active' && (
                <>
                  {listing.is_auction && !auctionEnded && (
                    <BidForm listing={listing} onBidPlaced={() => {
                      bidAPI.list(id).then(res => setBids(res.data))
                      listingAPI.get(id).then(res => setListing(res.data))
                    }} />
                  )}
                  {!listing.is_auction && (
                    <>
                      {buyError && <div className="alert alert-error" style={{ marginBottom: 8 }}>{buyError}</div>}
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', marginBottom: 8 }}
                        disabled={buyLoading}
                        onClick={handleBuyNow}
                      >
                        {buyLoading ? 'Processing...' : `Buy Now — $${listing.price}`}
                      </button>
                      <OfferForm listing={listing} />
                    </>
                  )}
                </>
              )}

              {/* Message Seller */}
              {!isSeller && user && (
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={() => navigate(`/inbox/${listing.seller_info?.id}`)}
                >
                  💬 Message Seller
                </button>
              )}

              {/* Favourite button */}
              {!isSeller && (
                <button
                  onClick={toggleFavorite}
                  disabled={favLoading}
                  style={{
                    width: '100%', marginTop: 10,
                    background: isFavorited ? 'rgba(255,80,80,0.1)' : 'var(--bg3)',
                    border: `1px solid ${isFavorited ? '#ff5050' : 'var(--border)'}`,
                    color: isFavorited ? '#ff5050' : 'var(--text2)',
                    borderRadius: 8, padding: '10px 0', cursor: 'pointer',
                    fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {isFavorited ? '♥ Saved' : '♡ Save to Favourites'}
                </button>
              )}

              {/* Share buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out "${listing.title}" on SellIt — $${listing.price}`)}&url=${encodeURIComponent(window.location.href)}`}
                  target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center', fontSize: '0.75rem' }}>
                  Twitter
                </a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center', fontSize: '0.75rem' }}>
                  Facebook
                </a>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: '0.75rem' }}
                  onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link copied!') }}>
                  Copy Link
                </button>
              </div>

              {/* Report button */}
              {!isSeller && user && (
                <button
                  onClick={() => setShowReport(true)}
                  style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: 'var(--text3)', fontSize: '0.78rem', cursor: 'pointer', padding: '4px 0' }}
                >
                  Report this listing
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showReport && <ReportModal listingId={listing.id} onClose={() => setShowReport(false)} />}

      {/* Contact Seller Modal */}
      {showContact && (
        <div
          onClick={closeContact}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="card card-body"
            style={{ width: '100%', maxWidth: 480 }}
          >
            <h3 style={{ marginBottom: 4 }}>Contact Seller</h3>
            <p style={{ color: 'var(--text3)', fontSize: '0.85rem', marginBottom: 20 }}>
              Send a message to <strong>{listing.seller_info?.username}</strong> about "{listing.title}"
            </p>

            {contactSent ? (
              <div>
                <div className="alert alert-success">Message sent! The seller will reply via email.</div>
                <button className="btn btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={closeContact}>Close</button>
              </div>
            ) : (
              <div>
                {contactError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{contactError}</div>}
                <div className="form-group">
                  <label>Your message</label>
                  <textarea
                    rows={4}
                    value={contactMsg}
                    onChange={e => setContactMsg(e.target.value)}
                    placeholder="Hi, I'm interested in this item..."
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={contactLoading || !contactMsg.trim()}
                    onClick={handleContact}
                  >
                    {contactLoading ? 'Sending...' : 'Send Message'}
                  </button>
                  <button className="btn btn-secondary" onClick={closeContact}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
