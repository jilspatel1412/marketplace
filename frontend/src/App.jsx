import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'

// Pages
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ResetPassword from './pages/ResetPassword'
import Listings from './pages/Listings'
import ListingDetail from './pages/ListingDetail'
import CreateListing from './pages/CreateListing'
import EditListing from './pages/EditListing'
import SellerDashboard from './pages/SellerDashboard'
import SellerListings from './pages/SellerListings'
import SellerOffers from './pages/SellerOffers'
import SellerOrders from './pages/SellerOrders'
import BuyerOrders from './pages/BuyerOrders'
import BuyerFavorites from './pages/BuyerFavorites'
import Checkout from './pages/Checkout'
import Profile from './pages/Profile'
import SellerProfile from './pages/SellerProfile'
import Inbox from './pages/Inbox'
import OrderDetail from './pages/OrderDetail'
import DisputeCenter from './pages/DisputeCenter'
import SearchAlerts from './pages/SearchAlerts'
import SupportPanel from './pages/SupportPanel'

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="spinner" />
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/listings/:id" element={<ListingDetail />} />
        <Route path="/seller/dashboard" element={<ProtectedRoute role="seller"><SellerDashboard /></ProtectedRoute>} />
        <Route path="/seller/listings" element={<ProtectedRoute role="seller"><SellerListings /></ProtectedRoute>} />
        <Route path="/seller/listings/new" element={<ProtectedRoute role="seller"><CreateListing /></ProtectedRoute>} />
        <Route path="/seller/listings/:id/edit" element={<ProtectedRoute role="seller"><EditListing /></ProtectedRoute>} />
        <Route path="/seller/offers" element={<ProtectedRoute role="seller"><SellerOffers /></ProtectedRoute>} />
        <Route path="/seller/orders" element={<ProtectedRoute role="seller"><SellerOrders /></ProtectedRoute>} />
        <Route path="/buyer/orders" element={<ProtectedRoute><BuyerOrders /></ProtectedRoute>} />
        <Route path="/buyer/favorites" element={<ProtectedRoute><BuyerFavorites /></ProtectedRoute>} />
        <Route path="/checkout/:orderId" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/sellers/:username" element={<SellerProfile />} />
        <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
        <Route path="/inbox/:partnerId" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
        <Route path="/disputes" element={<ProtectedRoute><DisputeCenter /></ProtectedRoute>} />
        <Route path="/search-alerts" element={<ProtectedRoute><SearchAlerts /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute role="admin"><SupportPanel /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
