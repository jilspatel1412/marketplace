import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listingAPI, categoryAPI } from '../api'
import ListingCard from '../components/ListingCard'

export default function Listings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [listings, setListings] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    category: searchParams.get('category') || '',
    condition: searchParams.get('condition') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
  })

  useEffect(() => {
    categoryAPI.list().then(res => setCategories(res.data)).catch(() => {})
  }, [])

  const fetchListings = useCallback(() => {
    setLoading(true)
    const params = {}
    if (filters.q) params.q = filters.q
    if (filters.category) params.category = filters.category
    if (filters.condition) params.condition = filters.condition
    if (filters.min_price) params.min_price = filters.min_price
    if (filters.max_price) params.max_price = filters.max_price
    listingAPI.list(params)
      .then(res => setListings(res.data.results || res.data))
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { fetchListings() }, [fetchListings])

  const handleSearch = (e) => {
    e.preventDefault()
    const newParams = {}
    if (filters.q) newParams.q = filters.q
    if (filters.category) newParams.category = filters.category
    if (filters.condition) newParams.condition = filters.condition
    if (filters.min_price) newParams.min_price = filters.min_price
    if (filters.max_price) newParams.max_price = filters.max_price
    setSearchParams(newParams)
    fetchListings()
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Browse Listings</h1>
          <p>{listings.length} items available</p>
        </div>

        {/* Search + Filters */}
        <form onSubmit={handleSearch} style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <input
              style={{ flex: '1 1 240px' }}
              placeholder="Search listings..."
              value={filters.q}
              onChange={e => setFilters({...filters, q: e.target.value})}
            />
            <select
              style={{ width: 160 }}
              value={filters.category}
              onChange={e => setFilters({...filters, category: e.target.value})}
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select
              style={{ width: 140 }}
              value={filters.condition}
              onChange={e => setFilters({...filters, condition: e.target.value})}
            >
              <option value="">Any Condition</option>
              <option value="new">New</option>
              <option value="used">Used</option>
              <option value="refurbished">Refurbished</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              style={{ width: 130 }}
              type="number" placeholder="Min price"
              value={filters.min_price}
              onChange={e => setFilters({...filters, min_price: e.target.value})}
            />
            <input
              style={{ width: 130 }}
              type="number" placeholder="Max price"
              value={filters.max_price}
              onChange={e => setFilters({...filters, max_price: e.target.value})}
            />
            <button className="btn btn-primary" type="submit">Search</button>
            <button className="btn btn-secondary" type="button" onClick={() => {
              setFilters({ q: '', category: '', condition: '', min_price: '', max_price: '' })
              setSearchParams({})
            }}>Clear</button>
          </div>
        </form>

        {loading ? (
          <div className="spinner" />
        ) : listings.length === 0 ? (
          <div className="empty-state">
            <h3>No listings found</h3>
            <p>Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="listings-grid">
            {listings.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </div>
    </div>
  )
}
