import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listingAPI, categoryAPI } from '../api'

export default function EditListing() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    Promise.all([listingAPI.get(id), categoryAPI.list()]).then(([lRes, cRes]) => {
      const l = lRes.data
      setForm({
        title: l.title, description: l.description,
        category: l.category || '',
        condition: l.condition, price: l.price,
        is_negotiable: l.is_negotiable, status: l.status,
        auction_end_time: l.auction_end_time ? l.auction_end_time.slice(0, 16) : '',
      })
      setCategories(cRes.data)
    }).finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.auction_end_time) payload.auction_end_time = null
      if (!payload.category) delete payload.category
      await listingAPI.update(id, payload)
      setSuccess('Listing updated!')
      setTimeout(() => navigate('/seller/listings'), 1200)
    } catch (err) {
      const data = err.response?.data
      setError(typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Update failed.')
    } finally { setSaving(false) }
  }

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
            <div className="form-row">
              <div className="form-group">
                <label>Price ($)</label>
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
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={form.is_negotiable} onChange={e => setForm({...form, is_negotiable: e.target.checked})} />
                Accept offers
              </label>
            </div>
            <div className="form-group">
              <label>Auction End Time</label>
              <input type="datetime-local" value={form.auction_end_time} onChange={e => setForm({...form, auction_end_time: e.target.value})} />
            </div>
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
