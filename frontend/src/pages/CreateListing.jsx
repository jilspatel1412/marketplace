import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { listingAPI, categoryAPI } from '../api'

export default function CreateListing() {
  const navigate = useNavigate()
  const fileRef = useRef()
  const [categories, setCategories] = useState([])
  const [listingType, setListingType] = useState('fixed') // 'fixed' | 'auction'
  const [form, setForm] = useState({
    title: '', description: '', category: '', condition: 'used',
    price: '', is_negotiable: false, status: 'active',
    auction_end_time: '',
  })
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    categoryAPI.list().then(res => setCategories(res.data)).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const payload = { ...form }
      if (listingType === 'fixed') {
        payload.auction_end_time = null
      } else {
        if (!payload.auction_end_time) {
          setError('Please set an auction end time.')
          setLoading(false)
          return
        }
      }
      if (!payload.category) delete payload.category
      const res = await listingAPI.create(payload)
      const id = res.data.id

      for (const img of images) {
        const fd = new FormData()
        fd.append('image', img)
        await listingAPI.uploadImage(id, fd)
      }

      navigate(`/listings/${id}`)
    } catch (err) {
      const data = err.response?.data
      if (typeof data === 'object') {
        setError(Object.values(data).flat().join(' '))
      } else {
        setError('Failed to create listing.')
      }
    } finally { setLoading(false) }
  }

  const typeBtn = (type, label, desc) => (
    <div
      onClick={() => setListingType(type)}
      style={{
        flex: 1, padding: '14px 16px', borderRadius: 8, cursor: 'pointer',
        border: `2px solid ${listingType === type ? 'var(--accent)' : 'var(--border)'}`,
        background: listingType === type ? 'rgba(var(--accent-rgb, 100,180,255),0.08)' : 'var(--bg3)',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 2, color: listingType === type ? 'var(--accent)' : 'var(--text1)' }}>{label}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{desc}</div>
    </div>
  )

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 680 }}>
        <div className="page-header">
          <h1>New Listing</h1>
          <p>List your item for sale</p>
        </div>
        <div className="card card-body">
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Title *</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="What are you selling?" />
            </div>
            <div className="form-group">
              <label>Description *</label>
              <textarea rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})} required placeholder="Describe your item..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Condition *</label>
                <select value={form.condition} onChange={e => setForm({...form, condition: e.target.value})}>
                  <option value="new">New</option>
                  <option value="used">Used</option>
                  <option value="refurbished">Refurbished</option>
                </select>
              </div>
            </div>

            {/* Listing Type */}
            <div className="form-group">
              <label>Listing Type *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {typeBtn('fixed', 'Fixed Price', 'Set a price, buyers buy instantly')}
                {typeBtn('auction', 'Auction', 'Buyers bid, highest wins')}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{listingType === 'auction' ? 'Starting Price ($) *' : 'Price ($) *'}</label>
                <input type="number" min="0.01" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {listingType === 'fixed' && (
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={form.is_negotiable} onChange={e => setForm({...form, is_negotiable: e.target.checked})} />
                  Accept offers (negotiable price)
                </label>
              </div>
            )}

            {listingType === 'auction' && (
              <div className="form-group">
                <label>Auction End Time *</label>
                <input
                  type="datetime-local"
                  value={form.auction_end_time}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  onChange={e => setForm({...form, auction_end_time: e.target.value})}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Images (up to 5)</label>
              <input
                type="file" accept="image/*" multiple ref={fileRef}
                style={{ padding: '10px 0', background: 'none', border: 'none' }}
                onChange={e => setImages(Array.from(e.target.files).slice(0, 5))}
              />
              {images.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {images.map((f, i) => (
                    <div key={i} style={{ width: 64, height: 64, borderRadius: 6, overflow: 'hidden', background: 'var(--bg3)' }}>
                      <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Creating...' : 'Create Listing'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => navigate('/seller/listings')}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
