import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">SellIt</Link>
        <div className="navbar-nav">
          <Link to="/listings" className="btn btn-ghost btn-sm">Browse</Link>
          {!user ? (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          ) : (
            <>
              {user.role === 'seller' && (
                <>
                  <Link to="/seller/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
                  <Link to="/seller/listings" className="btn btn-ghost btn-sm">My Listings</Link>
                  <Link to="/seller/offers" className="btn btn-ghost btn-sm">Offers</Link>
                </>
              )}
              {user.role === 'buyer' && (
                <>
                  <Link to="/buyer/orders" className="btn btn-ghost btn-sm">Orders</Link>
                  <Link to="/buyer/favorites" className="btn btn-ghost btn-sm">Favorites</Link>
                </>
              )}
              <Link to="/profile" className="btn btn-ghost btn-sm">{user.username}</Link>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm">Logout</button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
