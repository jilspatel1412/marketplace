import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listingAPI, categoryAPI } from '../api'

export default function EditListing() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef()
  const [categories, setCategories] = useState([])
  const [listingType, setListingType] = useState('fixed') // 'fixed' | 'auction'
  const [form, setForm] = useState(null)
  const [existingImages, setExistingImages] = useState([])
  const [newImages, setNewImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    Promise.all([listingAPI.get(id), categoryAPI.list()]).then(([lRes, cRes]) => {
      const l = lRes.data
      const hasAuction = !!l.auction_end_time
      setListingType(hasAuction ? 'auction' : 'fixed')
      setExistingImages(l.images || [])
      setForm({
        title: l.title, description: l.description,
        category: l.category || '',
        condition: l.condition, price: l.price,
        is_negotiable: l.is_negotiable, status: l.status,
        auction_end_time: l.auction_end_time ? l.auction_end_time.slice(0, 16) : '',
      })
      setCategories(cRes.data)
    }).catch(() => setError('Failed to load listing.')).finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      const payload = { ...form }
      if (listingType === 'fixed') {
        payload.auction_end_time = null
        // keep is_negotiable as-is
      } else {
        if (!payload.auction_end_time) {
          setError('Please set an auction end time.')
          setSaving(false)
          return
        }
        payload.is_negotiable = false
      }
      if (!payload.category) delete payload.category
      await listingAPI.update(id, payload)
      // Upload any new images
      for (const img of newImages) {
        const fd = new FormData()
        fd.append('image', img)
        await listingAPI.uploadImage(id, fd)
      }
      setSuccess('Listing updated!')
      setTimeout(() => navigate('/seller/listings'), 1200)
    } catch (err) {
      const data = err.response?.data
      setError(typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Update failed.')
    } finally { setSaving(false) }
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

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 680 }}>
        <div className="page-header">
          <h1>Edit Listing</h1>
        </div>
        <div className="card card-body">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Title</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
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
                <label>Condition</label>
                <select value={form.condition} onChange={e => setForm({...form, condition: e.target.value})}>
                  <option value="new">New</option>
                  <option value="used">Used</option>
                  <option value="refurbished">Refurbished</option>
                </select>
              </div>
            </div>

            {/* Listing Type */}
            <div className="form-group">
              <label>Listing Type</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {typeBtn('fixed', 'Fixed Price', 'Set a price, buyers buy instantly')}
                {typeBtn('auction', 'Auction', 'Buyers bid, highest wins')}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{listingType === 'auction' ? 'Starting Price ($)' : 'Price ($)'}</label>
                <input type="number" min="0.01" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="closed">Closed</option>
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
                  onChange={e => setForm({...form, auction_end_time: e.target.value})}
                  min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
                  required
                />
              </div>
            )}

            {/* Existing Images */}
            {existingImages.length > 0 && (
              <div className="form-group">
                <label>Current Images</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {existingImages.map(img => (
                    <div key={img.id} style={{ position: 'relative', width: 80, height: 80 }}>
                      <img src={img.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1.5px solid var(--border)' }} />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await listingAPI.deleteImage(id, img.id)
                            setExistingImages(prev => prev.filter(i => i.id !== img.id))
                          } catch { alert('Could not delete image.') }
                        }}
                        style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: 'var(--red)', color: '#fff', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, lineHeight: 1, border: '2px solid var(--bg)' }}
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Images */}
            {existingImages.length < 5 && (
              <div className="form-group">
                <label>Add Images ({existingImages.length}/5 used)</label>
                <input
                  type="file" accept="image/*" multiple ref={fileRef}
                  style={{ padding: '10px 0', background: 'none', border: 'none' }}
                  onChange={e => setNewImages(Array.from(e.target.files).slice(0, 5 - existingImages.length))}
                />
                {newImages.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {newImages.map((f, i) => (
                      <div key={i} style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border)' }}>
                        <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => navigate('/seller/listings')}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
