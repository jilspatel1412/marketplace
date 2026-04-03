import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { notificationAPI } from '../api'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const bellRef = useRef(null)

  useEffect(() => {
    if (!user) return
    const load = () => notificationAPI.list().then(r => {
      setNotifs(r.data.results || [])
      setUnread(r.data.unread || 0)
    }).catch(() => {})
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on navigation
  useEffect(() => {
    setMenuOpen(false)
  }, [navigate])

  const handleBellClick = () => {
    setOpen(o => !o)
    if (!open && unread > 0) {
      notificationAPI.markAllRead().then(() => setUnread(0))
    }
  }

  const handleNotifClick = (notif) => {
    setOpen(false)
    if (notif.link) navigate(notif.link)
  }

  const handleLogout = () => { logout(); navigate('/'); setMenuOpen(false) }

  const navTo = (path) => { navigate(path); setMenuOpen(false) }

  const timeAgo = (dt) => {
    const s = Math.floor((Date.now() - new Date(dt)) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return `${Math.floor(s / 86400)}d ago`
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo" onClick={() => setMenuOpen(false)}>SellIt</Link>

        {/* Hamburger button — mobile only */}
        <button className="navbar-toggle" onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
          <span className={`hamburger ${menuOpen ? 'open' : ''}`}>
            <span /><span /><span />
          </span>
        </button>

        <div className={`navbar-nav ${menuOpen ? 'nav-open' : ''}`}>
          <Link to="/listings" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>Browse</Link>
          {!user ? (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>Sign Up</Link>
            </>
          ) : (
            <>
              {user.role === 'seller' && (
                <>
                  <Link to="/seller/dashboard" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                  <Link to="/seller/listings" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>My Listings</Link>
                  <Link to="/seller/offers" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>Offers</Link>
                  <Link to="/seller/orders" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>Orders</Link>
                </>
              )}
              {user.role === 'buyer' && (
                <>
                  <Link to="/buyer/orders" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>Orders</Link>
                  <Link to="/buyer/favorites" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>Favorites</Link>
                </>
              )}
              {user.role === 'admin' && (
                <Link to="/support" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>Support Panel</Link>
              )}
              <Link to="/inbox" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>Inbox</Link>

              {/* Notification Bell */}
              <div ref={bellRef} style={{ position: 'relative' }}>
                <button
                  onClick={handleBellClick}
                  style={{ position: 'relative', background: 'none', color: unread > 0 ? 'var(--accent2)' : 'rgba(255,255,255,0.7)', fontSize: '1.1rem', padding: '8px 10px', borderRadius: 8, transition: 'color 0.15s' }}
                  title="Notifications"
                >
                  🔔
                  {unread > 0 && (
                    <span style={{ position: 'absolute', top: 2, right: 2, background: 'var(--accent)', color: '#fff', fontSize: '0.62rem', fontWeight: 800, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>

                {open && (
                  <div className="notif-dropdown">
                    <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Notifications</span>
                    </div>
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                      {notifs.length === 0 ? (
                        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem' }}>No notifications yet</div>
                      ) : notifs.map(n => (
                        <div
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: n.link ? 'pointer' : 'default', background: n.is_read ? '#fff' : 'rgba(224,61,0,0.04)', transition: 'background 0.15s' }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)', marginBottom: 2 }}>{n.title}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: 1.5 }}>{n.message}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Link to="/profile" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>{user.username}</Link>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm">Logout</button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
