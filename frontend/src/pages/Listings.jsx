import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listingAPI, categoryAPI, searchAlertAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import ListingCard from '../components/ListingCard'

export default function Listings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [listings, setListings] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    category: searchParams.get('category') || '',
    condition: searchParams.get('condition') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    sort: searchParams.get('sort') || 'newest',
    listing_type: searchParams.get('listing_type') || '',
  })
  const [saveAlertMsg, setSaveAlertMsg] = useState('')
  const [savingAlert, setSavingAlert] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    categoryAPI.list().then(res => setCategories(res.data)).catch(() => {})
  }, [])

  const fetchListings = useCallback((p = page) => {
    setLoading(true)
    const params = { page: p }
    if (filters.q) params.q = filters.q
    if (filters.category) params.category = filters.category
    if (filters.condition) params.condition = filters.condition
    if (filters.min_price) params.min_price = filters.min_price
    if (filters.max_price) params.max_price = filters.max_price
    if (filters.sort) params.sort = filters.sort
    if (filters.listing_type) params.listing_type = filters.listing_type
    listingAPI.list(params)
      .then(res => {
        const data = res.data
        setListings(data.results || data)
        setTotalPages(data.total_pages || 1)
        setTotalCount(data.count || (data.results || data).length)
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }, [filters, page])

  useEffect(() => { fetchListings() }, [fetchListings])

  const handleSearch = (e) => {
    e.preventDefault()
    const newParams = {}
    if (filters.q) newParams.q = filters.q
    if (filters.category) newParams.category = filters.category
    if (filters.condition) newParams.condition = filters.condition
    if (filters.min_price) newParams.min_price = filters.min_price
    if (filters.max_price) newParams.max_price = filters.max_price
    if (filters.listing_type) newParams.listing_type = filters.listing_type
    setSearchParams(newParams)
    setPage(1)
    fetchListings(1)
  }

  const handlePageChange = (p) => {
    setPage(p)
    fetchListings(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSaveAlert = async () => {
    if (!user) { setSaveAlertMsg('Log in to save search alerts.'); return }
    setSavingAlert(true)
    setSaveAlertMsg('')
    const parts = []
    if (filters.q) parts.push(filters.q)
    if (filters.category) {
      const cat = categories.find(c => c.slug === filters.category)
      if (cat) parts.push(cat.name)
    }
    if (filters.listing_type) parts.push(filters.listing_type)
    const label = parts.join(' · ') || 'All listings'

    const catObj = categories.find(c => c.slug === filters.category)
    try {
      await searchAlertAPI.create({
        label,
        query: filters.q,
        category: catObj?.id || '',
        condition: filters.condition,
        max_price: filters.max_price || '',
      })
      setSaveAlertMsg('Alert saved! We will notify you when new matches are listed.')
    } catch (err) {
      setSaveAlertMsg(err.response?.data?.error || 'Could not save alert.')
    } finally { setSavingAlert(false) }
  }

  const hasActiveFilters = filters.q || filters.category || filters.condition ||
    filters.min_price || filters.max_price || filters.listing_type

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Browse Listings</h1>
          <p>{totalCount} items available</p>
        </div>

        {/* Search + Filters */}
        <form onSubmit={handleSearch} style={{ marginBottom: 24 }}>
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
            <select
              style={{ width: 140 }}
              value={filters.listing_type}
              onChange={e => setFilters({...filters, listing_type: e.target.value})}
            >
              <option value="">All Types</option>
              <option value="fixed">Fixed Price</option>
              <option value="auction">Auction</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
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
            <select
              style={{ width: 160 }}
              value={filters.sort}
              onChange={e => setFilters({...filters, sort: e.target.value})}
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="ending_soon">Ending Soon</option>
            </select>
            <button className="btn btn-primary" type="submit">Search</button>
            <button className="btn btn-secondary" type="button" onClick={() => {
              setFilters({ q: '', category: '', condition: '', min_price: '', max_price: '', sort: 'newest', listing_type: '' })
              setSearchParams({})
              setSaveAlertMsg('')
            }}>Clear</button>
          </div>
        </form>

        {/* Save Search Alert */}
        {hasActiveFilters && (
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSaveAlert}
              disabled={savingAlert}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              🔔 {savingAlert ? 'Saving...' : 'Save this search'}
            </button>
            {saveAlertMsg && (
              <span style={{ fontSize: '0.82rem', color: saveAlertMsg.includes('saved') ? 'var(--green)' : 'var(--red)' }}>
                {saveAlertMsg}
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className="spinner" />
        ) : listings.length === 0 ? (
          <div className="empty-state">
            <h3>No listings found</h3>
            <p>Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="listings-grid">
              {listings.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 40 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handlePageChange(page - 1)} disabled={page === 1}>← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('…')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) => p === '…'
                    ? <span key={`ellipsis-${i}`} style={{ color: 'var(--text3)', padding: '0 4px' }}>…</span>
                    : <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handlePageChange(p)}>{p}</button>
                  )
                }
                <button className="btn btn-secondary btn-sm" onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
