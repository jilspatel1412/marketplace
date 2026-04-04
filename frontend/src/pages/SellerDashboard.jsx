import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyticsAPI } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function SellerDashboard() {
  const navigate = useNavigate()
  const [revenue, setRevenue] = useState(null)
  const [trends, setTrends] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([analyticsAPI.revenue(), analyticsAPI.searchTrends()])
      .then(([revRes, trendRes]) => {
        setRevenue(revRes.data)
        setTrends(trendRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner" />

  const keywordsData = trends?.top_keywords?.map(k => ({ name: k.keyword, count: k.count })) || []
  const weeklyData = trends?.weekly_volume?.map(w => ({ week: w.week.slice(5), count: w.count })) || []

  return (
    <div className="page">
      <div className="container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Seller Dashboard</h1>
            <p>Your performance overview</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/seller/listings/new')}>+ New Listing</button>
        </div>

        {/* Revenue widgets */}
        <div className="widgets-grid">
          <div className="widget">
            <div className="widget-value">${revenue?.total_revenue || '0.00'}</div>
            <div className="widget-label">Total Revenue</div>
          </div>
          <div className="widget">
            <div className="widget-value" style={{ color: '#4ade80' }}>{revenue?.active_listings || 0}</div>
            <div className="widget-label">Active Listings</div>
          </div>
          <div className="widget">
            <div className="widget-value" style={{ color: '#94a3b8' }}>{revenue?.sold_listings || 0}</div>
            <div className="widget-label">Sold</div>
          </div>
          <div className="widget">
            <div className="widget-value" style={{ color: '#64748b' }}>{revenue?.draft_listings || 0}</div>
            <div className="widget-label">Drafts</div>
          </div>
        </div>

        <div className="dashboard-charts-grid">
          {/* Weekly search volume */}
          <div className="card card-body">
            <h3 style={{ marginBottom: 20 }}>Weekly Search Volume</h3>
            {weeklyData.length === 0 ? (
              <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>No search data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyData}>
                  <XAxis dataKey="week" tick={{ fill: '#636375', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#636375', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top searched keywords */}
          <div className="card card-body">
            <h3 style={{ marginBottom: 20 }}>Top Search Keywords</h3>
            {keywordsData.length === 0 ? (
              <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>No keyword data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={keywordsData} layout="vertical">
                  <XAxis type="number" tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#36363f', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Bar dataKey="count" fill="var(--accent2)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Recent Sales</h3>
          </div>
          {revenue?.recent_orders?.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 24px' }}>
              <p>No sales yet. Keep listing!</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Item</th><th>Buyer</th><th>Amount</th><th>Date</th></tr></thead>
                <tbody>
                  {(revenue?.recent_orders || []).map(o => (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--text3)' }}>#{o.id}</td>
                      <td>{o.listing_title}</td>
                      <td>{o.buyer}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 700 }}>${o.amount}</td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{o.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/seller/listings')}>Manage Listings</button>
          <button className="btn btn-secondary" onClick={() => navigate('/seller/offers')}>View Offers</button>
        </div>
      </div>
    </div>
  )
}
