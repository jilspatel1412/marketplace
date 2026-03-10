import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listingAPI } from '../api'
import ListingCard from '../components/ListingCard'

export default function BuyerFavorites() {
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listingAPI.favorites().then(res => setFavorites(res.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Saved Items</h1>
          <p>{favorites.length} favorited listings</p>
        </div>
        {loading ? <div className="spinner" /> : favorites.length === 0 ? (
          <div className="empty-state">
            <h3>No saved items</h3>
            <p>Tap the favorite button on any listing to save it here.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/listings')}>Browse Listings</button>
          </div>
        ) : (
          <div className="listings-grid">
            {favorites.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </div>
    </div>
  )
}
