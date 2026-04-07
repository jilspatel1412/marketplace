import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminAPI, disputeAPI } from '../api'

const DISPUTE_STATUS_LABELS = {
  open: 'Open',
  under_review: 'Under Review',
  resolved_refund: 'Resolved (Refund)',
  resolved_no_refund: 'Resolved (No Refund)',
  closed: 'Closed',
}

const DISPUTE_STATUS_COLOR = {
  open: '#f59e0b',
  under_review: '#3b82f6',
  resolved_refund: 'var(--green)',
  resolved_no_refund: 'var(--text3)',
  closed: 'var(--text3)',
}

export default function SupportPanel() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('disputes')
  const [stats, setStats] = useState(null)
  const [disputes, setDisputes] = useState([])
  const [reports, setReports] = useState([])
  const [users, setUsers] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [resolution, setResolution] = useState('')
  const [updating, setUpdating] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [listingSearch, setListingSearch] = useState('')
  const [activityLogs, setActivityLogs] = useState([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      adminAPI.stats(),
      disputeAPI.list(),
      adminAPI.reports(),
      adminAPI.users(),
      adminAPI.listings(),
    ]).then(([statsRes, disputesRes, reportsRes, usersRes, listingsRes]) => {
      setStats(statsRes.data)
      setDisputes(disputesRes.data)
      setReports(reportsRes.data)
      setUsers(usersRes.data)
      setListings(listingsRes.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleUpdateDispute = async (disputeId, newStatus) => {
    setUpdating(true)
    try {
      const payload = { status: newStatus }
      if (resolution.trim()) payload.resolution = resolution.trim()
      const res = await disputeAPI.update(disputeId, payload)
      setDisputes(prev => prev.map(d => d.id === disputeId ? res.data : d))
      if (selected?.id === disputeId) setSelected(res.data)
      setResolution('')
    } catch {}
    setUpdating(false)
  }

  const handleDismissReport = async (reportId) => {
    try {
      await adminAPI.deleteReport(reportId)
      setReports(prev => prev.filter(r => r.id !== reportId))
      setStats(prev => prev ? { ...prev, open_reports: Math.max(0, prev.open_reports - 1) } : prev)
    } catch {}
  }

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user and all their data?')) return
    try {
      await adminAPI.deleteUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
      setStats(prev => prev ? { ...prev, total_users: prev.total_users - 1 } : prev)
    } catch {}
  }

  const handleToggleUser = async (userId, field, value) => {
    try {
      const res = await adminAPI.updateUser(userId, { [field]: value })
      setUsers(prev => prev.map(u => u.id === userId ? res.data : u))
    } catch {}
  }

  const handleDeleteListing = async (listingId) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return
    try {
      await adminAPI.deleteListing(listingId)
      setListings(prev => prev.filter(l => l.id !== listingId))
      setStats(prev => prev ? { ...prev, total_listings: prev.total_listings - 1 } : prev)
    } catch {}
  }

  if (loading) return <div className="spinner" />

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  )

  const filteredListings = listings.filter(l =>
    l.title.toLowerCase().includes(listingSearch.toLowerCase()) ||
    l.seller_username.toLowerCase().includes(listingSearch.toLowerCase())
  )

  const badgeStyle = (color, bg) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: 12,
    fontSize: '0.75rem', fontWeight: 700, color, background: bg,
  })

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Support Panel</h1>
          <p>Full admin control — manage users, listings, disputes, and reports</p>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 32 }}>
            {[
              { label: 'Open Disputes', value: stats.open_disputes, color: '#f59e0b' },
              { label: 'Total Disputes', value: stats.total_disputes, color: 'var(--text2)' },
              { label: 'Reports', value: stats.open_reports, color: '#ef4444' },
              { label: 'Orders', value: stats.total_orders, color: 'var(--accent)' },
              { label: 'Users', value: stats.total_users, color: '#3b82f6' },
              { label: 'Active Listings', value: stats.total_listings, color: 'var(--green)' },
            ].map(s => (
              <div key={s.label} className="card card-body card-static" style={{ textAlign: 'center', padding: '16px 12px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { key: 'disputes', label: `Disputes (${disputes.filter(d => d.status === 'open' || d.status === 'under_review').length})` },
            { key: 'reports', label: `Reports (${reports.length})` },
            { key: 'users', label: `Users (${users.length})` },
            { key: 'listings', label: `Listings (${listings.length})` },
            { key: 'activity', label: 'Activity Logs' },
          ].map(t => (
            <button
              key={t.key}
              className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setTab(t.key); setSelected(null) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ DISPUTES TAB ═══ */}
        {tab === 'disputes' && (
          <div className="support-dispute-grid" style={{ display: 'grid', gridTemplateColumns: selected ? '5fr 3fr' : '1fr', gap: 24 }}>
            <div className="card card-static">
              <div className="table-wrap">
                <table style={{ minWidth: 640 }}>
                  <thead>
                    <tr><th>#</th><th>Order</th><th>Opened By</th><th>Reason</th><th>Status</th><th>Date</th><th></th></tr>
                  </thead>
                  <tbody>
                    {disputes.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No disputes</td></tr>
                    ) : disputes.map(d => (
                      <tr key={d.id} style={{ background: selected?.id === d.id ? 'rgba(255,77,0,0.05)' : '' }}>
                        <td style={{ color: 'var(--text3)' }}>#{d.id}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>Order #{d.order}</span>
                          {d.order_listing && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{d.order_listing}</div>}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{d.opened_by_username}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text2)', textTransform: 'capitalize' }}>
                          {d.reason.replace(/_/g, ' ')}
                        </td>
                        <td>
                          <span style={{ color: DISPUTE_STATUS_COLOR[d.status], fontWeight: 600, fontSize: '0.82rem' }}>
                            {DISPUTE_STATUS_LABELS[d.status] || d.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(d.created_at).toLocaleDateString()}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(selected?.id === d.id ? null : d)}>
                            {selected?.id === d.id ? 'Close' : 'Manage'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selected && (
              <div className="card card-body" style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>Dispute #{selected.id}</h3>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '1.2rem' }}>x</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase' }}>Order</div>
                    <div style={{ fontWeight: 600 }}>#{selected.order} — {selected.order_listing || 'Deleted listing'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase' }}>Opened By</div>
                    <div>{selected.opened_by_username}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase' }}>Reason</div>
                    <div style={{ textTransform: 'capitalize' }}>{selected.reason.replace(/_/g, ' ')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase' }}>Status</div>
                    <span style={{ color: DISPUTE_STATUS_COLOR[selected.status], fontWeight: 700 }}>
                      {DISPUTE_STATUS_LABELS[selected.status]}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase' }}>Description</div>
                    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text2)' }}>
                      {selected.description}
                    </div>
                  </div>
                  {selected.resolution && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase' }}>Resolution</div>
                      <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: '0.88rem', lineHeight: 1.7 }}>
                        {selected.resolution}
                      </div>
                    </div>
                  )}
                  {selected.status !== 'closed' && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase' }}>Resolution Note</div>
                      <textarea
                        rows={3} value={resolution} onChange={e => setResolution(e.target.value)}
                        placeholder="Add a note about the resolution..." style={{ marginBottom: 12, width: '100%' }}
                      />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selected.status === 'open' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}
                            disabled={updating} onClick={() => handleUpdateDispute(selected.id, 'under_review')}>
                            Mark Under Review
                          </button>
                        )}
                        <button className="btn btn-sm" style={{ background: 'rgba(74,222,128,0.1)', color: '#22c55e', border: '1px solid rgba(74,222,128,0.2)' }}
                          disabled={updating} onClick={() => handleUpdateDispute(selected.id, 'resolved_refund')}>
                          Resolve (Refund)
                        </button>
                        <button className="btn btn-sm" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                          disabled={updating} onClick={() => handleUpdateDispute(selected.id, 'resolved_no_refund')}>
                          Resolve (No Refund)
                        </button>
                        <button className="btn btn-sm" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                          disabled={updating} onClick={() => handleUpdateDispute(selected.id, 'closed')}>
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate(`/orders/${selected.order}`)}>
                    View Order
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ REPORTS TAB ═══ */}
        {tab === 'reports' && (
          <div className="card card-static">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Listing</th><th>Seller</th><th>Reporter</th><th>Reason</th><th>Detail</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No reports</td></tr>
                  ) : reports.map(r => (
                    <tr key={r.id}>
                      <td>
                        <span style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate(`/listings/${r.listing_id}`)}>
                          {r.listing_title}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{r.seller_username}</td>
                      <td style={{ fontSize: '0.85rem' }}>{r.reporter_username}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>{r.reason_display}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.detail || '\u2014'}
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/listings/${r.listing_id}`)}>View</button>
                          <button className="btn btn-sm" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                            onClick={() => handleDismissReport(r.id)}>
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ USERS TAB ═══ */}
        {tab === 'users' && (
          <div className="card card-static">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <input
                type="text" placeholder="Search users by name or email..." value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Username</th><th>Email</th><th>Role</th><th>Verified</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No users found</td></tr>
                  ) : filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.username}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>{u.email}</td>
                      <td>
                        <span style={badgeStyle(
                          u.role === 'admin' ? '#ef4444' : u.role === 'seller' ? 'var(--accent)' : '#3b82f6',
                          u.role === 'admin' ? 'rgba(239,68,68,0.1)' : u.role === 'seller' ? 'rgba(255,77,0,0.1)' : 'rgba(59,130,246,0.1)'
                        )}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleUser(u.id, 'is_verified', !u.is_verified)}
                          style={badgeStyle(
                            u.is_verified ? 'var(--green)' : '#f59e0b',
                            u.is_verified ? 'rgba(74,222,128,0.1)' : 'rgba(245,158,11,0.1)',
                          )}
                        >
                          {u.is_verified ? 'VERIFIED' : 'UNVERIFIED'}
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleUser(u.id, 'is_active', !u.is_active)}
                          style={badgeStyle(
                            u.is_active ? 'var(--green)' : '#ef4444',
                            u.is_active ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                          )}
                        >
                          {u.is_active ? 'ACTIVE' : 'BANNED'}
                        </button>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(u.date_joined).toLocaleDateString()}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ LISTINGS TAB ═══ */}
        {tab === 'listings' && (
          <div className="card card-static">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <input
                type="text" placeholder="Search listings by title or seller..." value={listingSearch}
                onChange={e => setListingSearch(e.target.value)}
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Title</th><th>Price</th><th>Seller</th><th>Category</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredListings.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No listings found</td></tr>
                  ) : filteredListings.map(l => (
                    <tr key={l.id}>
                      <td>
                        <span style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate(`/listings/${l.id}`)}>
                          {l.title}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>${l.price}</td>
                      <td style={{ fontSize: '0.85rem' }}>{l.seller_username}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>{l.category || '\u2014'}</td>
                      <td>
                        <span style={badgeStyle(
                          l.status === 'active' ? 'var(--green)' : l.status === 'sold' ? '#3b82f6' : 'var(--text3)',
                          l.status === 'active' ? 'rgba(74,222,128,0.1)' : l.status === 'sold' ? 'rgba(59,130,246,0.1)' : 'var(--bg3)',
                        )}>
                          {l.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(l.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/listings/${l.id}`)}>View</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteListing(l.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ ACTIVITY LOGS TAB ═══ */}
        {tab === 'activity' && (
          <div className="card card-static">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={() => {
                adminAPI.activityLogs().then(res => setActivityLogs(res.data)).catch(() => {})
              }}>
                Load Logs
              </button>
              <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
                {activityLogs.length > 0 ? `${activityLogs.length} entries` : 'Click to load recent activity'}
              </span>
            </div>
            <div className="table-wrap">
              <table style={{ minWidth: 600 }}>
                <thead>
                  <tr><th>User</th><th>Action</th><th>IP Address</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {activityLogs.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No logs loaded</td></tr>
                  ) : activityLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>{log.username}</td>
                      <td>
                        <span style={badgeStyle(
                          log.action === 'login' ? 'var(--green)' : log.action === 'login_failed' ? 'var(--red)' : '#3b82f6',
                          log.action === 'login' ? 'rgba(74,222,128,0.1)' : log.action === 'login_failed' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)'
                        )}>
                          {log.action.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text2)', fontFamily: 'monospace' }}>{log.ip_address || '—'}</td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
