import { useNavigate } from 'react-router-dom'
import Countdown from './Countdown'

const PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNTU1NTY1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'

export default function ListingCard({ listing }) {
  const navigate = useNavigate()
  const imgUrl = listing.images?.[0]?.image_url || PLACEHOLDER
  const conditionClass = { new: 'badge-new', used: 'badge-used', refurbished: 'badge-refurbished' }[listing.condition] || 'badge-used'

  return (
    <div className="card listing-card" onClick={() => navigate(`/listings/${listing.id}`)}>
      <div className="listing-card-img">
        <img src={imgUrl} alt={listing.title} loading="lazy" onError={e => { e.target.src = PLACEHOLDER }} />
        {listing.is_auction && (
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <span className="badge badge-auction">Auction</span>
          </div>
        )}
      </div>
      <div className="listing-card-body">
        <div className="listing-card-title">{listing.title}</div>
        <div className="listing-card-meta">
          <span className="listing-card-price">
            {listing.is_auction && listing.current_bid
              ? `$${listing.current_bid} bid`
              : `$${listing.price}`}
          </span>
          <span className={`badge ${conditionClass}`}>{listing.condition}</span>
        </div>
        {listing.is_auction && listing.auction_end_time && (
          <div style={{ marginTop: 8 }}>
            <Countdown endTime={listing.auction_end_time} compact />
          </div>
        )}
        {listing.is_negotiable && !listing.is_auction && (
          <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text2)' }}>Offers welcome</div>
        )}
        {listing.seller_info?.avg_rating && (
          <div style={{ marginTop: 4, fontSize: '0.74rem', color: '#f59e0b' }}>
            {'★'.repeat(Math.round(listing.seller_info.avg_rating))}{'☆'.repeat(5 - Math.round(listing.seller_info.avg_rating))}
            <span style={{ color: 'var(--text3)', marginLeft: 4 }}>{listing.seller_info.avg_rating}</span>
          </div>
        )}
      </div>
    </div>
  )
}
