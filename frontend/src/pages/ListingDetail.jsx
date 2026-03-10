import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listingAPI, bidAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import ImageGallery from '../components/ImageGallery'
import Countdown from '../components/Countdown'
import OfferForm from '../components/OfferForm'
import BidForm from '../components/BidForm'
import ListingCard from '../components/ListingCard'

export default function ListingDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [listing, setListing] = useState(null)
  const [related, setRelated] = useState([])
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [auctionEnded, setAuctionEnded] = useState(false)

  const fetchListing = () => {
    listingAPI.get(id).then(res => {
      setListing(res.data)
      if (res.data.auction_end_time) {
        setAuctionEnded(new Date(res.data.auction_end_time) < new Date())
      }
    }).catch(() => navigate('/listings'))
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      listingAPI.get(id),
      listingAPI.related(id),
      bidAPI.list(id),
    ]).then(([listRes, relRes, bidRes]) => {
      setListing(listRes.data)
      setRelated(relRes.data)
      setBids(bidRes.data)
      if (listRes.data.auction_end_time) {
        setAuctionEnded(new Date(listRes.data.auction_end_time) < new Date())
      }
    }).catch(() => navigate('/listings')).finally(() => setLoading(false))

    // Log view
    if (user) listingAPI.logView(id).catch(() => {})
  }, [id])

  if (loading) return <div className="spinner" />
  if (!listing) return null

  const isSeller = user && listing.seller_info?.id === user.id
  const conditionClass = { new: 'badge-new', used: 'badge-used', refurbished: 'badge-refurbished' }[listing.condition]

  return (
    <div className="page">
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 40, alignItems: 'start' }}>
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
                      onExpire={() => { setAuctionEnded(true); fetchListing() }}
                    />
                  )}
                </div>
              )}

              <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', marginBottom: 16 }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 4 }}>Seller</div>
                <div style={{ fontWeight: 600 }}>
                  {listing.seller_info?.username}
                  {listing.seller_info?.is_verified && <span style={{ marginLeft: 6, color: 'var(--green)', fontSize: '0.75rem' }}>✓ Verified</span>}
                </div>
              </div>

              {/* Seller actions */}
              {isSeller && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate(`/seller/listings/${listing.id}/edit`)}>Edit</button>
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
                  {listing.is_negotiable && !listing.is_auction && (
                    <OfferForm listing={listing} />
                  )}
                  {!listing.is_negotiable && !listing.is_auction && (
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
                      Contact Seller
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
