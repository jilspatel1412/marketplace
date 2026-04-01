import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/auth/token/refresh/`, { refresh })
          localStorage.setItem('access_token', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/api/auth/register/', data),
  login: (data) => api.post('/api/auth/login/', data),
  refreshToken: (refresh) => api.post('/api/auth/token/refresh/', { refresh }),
  verifyEmail: (token) => api.get(`/api/auth/verify-email/?token=${token}`),
  resendVerification: (email) => api.post('/api/auth/resend-verification/', { email }),
  passwordResetRequest: (email) => api.post('/api/auth/password-reset/', { email }),
  passwordResetConfirm: (data) => api.post('/api/auth/password-reset/confirm/', data),
  me: () => api.get('/api/auth/me/'),
  updateMe: (data) => api.patch('/api/auth/me/', data),
}

// ─── Categories ────────────────────────────────────────────────────────────
export const categoryAPI = {
  list: () => api.get('/api/listings/categories/'),
}

// ─── Listings ──────────────────────────────────────────────────────────────
export const listingAPI = {
  list: (params) => api.get('/api/listings/', { params }),
  create: (data) => api.post('/api/listings/', data),
  get: (id) => api.get(`/api/listings/${id}/`),
  update: (id, data) => api.patch(`/api/listings/${id}/`, data),
  delete: (id) => api.delete(`/api/listings/${id}/`),
  uploadImage: (id, formData) => api.post(`/api/listings/${id}/images/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  related: (id) => api.get(`/api/listings/${id}/related/`),
  myListings: () => api.get('/api/listings/my/'),
  logView: (id) => api.post(`/api/listings/${id}/view/`),
  favorite: (id) => api.post(`/api/listings/${id}/favorite/`),
  unfavorite: (id) => api.delete(`/api/listings/${id}/favorite/`),
  favorites: () => api.get('/api/listings/favorites/'),
  contact: (id, data) => api.post(`/api/listings/${id}/contact/`, data),
  buyNow: (id) => api.post(`/api/listings/${id}/buy/`),
  acceptBid: (id) => api.post(`/api/listings/${id}/accept-bid/`),
  deleteImage: (listingId, imageId) => api.delete(`/api/listings/${listingId}/images/${imageId}/`),
  report: (id, data) => api.post(`/api/listings/${id}/report/`, data),
}

// ─── Offers ────────────────────────────────────────────────────────────────
export const offerAPI = {
  listForListing: (listingId) => api.get(`/api/listings/${listingId}/offers/`),
  create: (listingId, data) => api.post(`/api/listings/${listingId}/offers/`, data),
  update: (offerId, data) => api.patch(`/api/listings/offers/${offerId}/`, data),
  myOffers: () => api.get('/api/listings/my/offers/'),
}

// ─── Bids ──────────────────────────────────────────────────────────────────
export const bidAPI = {
  list: (listingId) => api.get(`/api/listings/${listingId}/bids/`),
  place: (listingId, amount) => api.post(`/api/listings/${listingId}/bids/`, { amount }),
}

// ─── Orders ────────────────────────────────────────────────────────────────
export const orderAPI = {
  list: () => api.get('/api/orders/'),
  get: (id) => api.get(`/api/orders/${id}/`),
  shippingLabel: (id) => `${api.defaults.baseURL}/api/orders/${id}/shipping-label/`,
  updateStatus: (id, data) => api.patch(`/api/orders/${id}/status/`, data),
  createReview: (id, data) => api.post(`/api/orders/${id}/review/`, data),
  sellerReviews: (sellerId) => api.get(`/api/orders/seller/${sellerId}/reviews/`),
}

// ─── Disputes ──────────────────────────────────────────────────────────────
export const disputeAPI = {
  list: () => api.get('/api/orders/disputes/'),
  create: (data) => api.post('/api/orders/disputes/', data),
  get: (id) => api.get(`/api/orders/disputes/${id}/`),
  update: (id, data) => api.patch(`/api/orders/disputes/${id}/`, data),
}

// ─── Search Alerts ─────────────────────────────────────────────────────────
export const searchAlertAPI = {
  list: () => api.get('/api/listings/search-alerts/'),
  create: (data) => api.post('/api/listings/search-alerts/', data),
  delete: (id) => api.delete(`/api/listings/search-alerts/${id}/`),
  toggle: (id, isActive) => api.patch(`/api/listings/search-alerts/${id}/`, { is_active: isActive }),
}

// ─── Users ─────────────────────────────────────────────────────────────────
export const userAPI = {
  sellerProfile: (username) => api.get(`/api/auth/sellers/${username}/`),
}

// ─── Notifications ──────────────────────────────────────────────────────────
export const notificationAPI = {
  list: () => api.get('/api/notifications/'),
  markRead: (id) => api.post(`/api/notifications/${id}/read/`),
  markAllRead: () => api.post('/api/notifications/read-all/'),
}

// ─── Payments ──────────────────────────────────────────────────────────────
export const paymentAPI = {
  createIntent: (orderId) => api.post('/api/payments/create-intent/', { order_id: orderId }),
}

// ─── Messages ──────────────────────────────────────────────────────────────
export const messageAPI = {
  threads: () => api.get('/api/messages/'),
  unread: () => api.get('/api/messages/unread/'),
  thread: (partnerId) => api.get(`/api/messages/${partnerId}/`),
  send: (partnerId, data) => api.post(`/api/messages/${partnerId}/`, data),
}

// ─── Analytics ─────────────────────────────────────────────────────────────
export const analyticsAPI = {
  searchTrends: () => api.get('/api/analytics/search-trends/'),
  revenue: () => api.get('/api/analytics/revenue/'),
}

export default api
