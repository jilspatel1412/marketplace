import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { listingAPI, categoryAPI } from '../api'

export default function CreateListing() {
  const navigate = useNavigate()
  const fileRef = useRef()
  const [categories, setCategories] = useState([])
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
      if (!payload.auction_end_time) delete payload.auction_end_time
      if (!payload.category) delete payload.category
      const res = await listingAPI.create(payload)
      const id = res.data.id

      // Upload images
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

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 680 }}>
        <div className="page-header">
          <h1>New Listing</h1>
          <p>List your item for sale or auction</p>
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
            <div className="form-row">
              <div className="form-group">
                <label>Price ($) *</label>
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
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={form.is_negotiable} onChange={e => setForm({...form, is_negotiable: e.target.checked})} />
                Accept offers (negotiable price)
              </label>
            </div>
            <div className="form-group">
              <label>Auction End Time (leave blank for fixed price)</label>
              <input type="datetime-local" value={form.auction_end_time} onChange={e => setForm({...form, auction_end_time: e.target.value})} />
            </div>
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
