# SellIt — Peer-to-Peer Auction Marketplace

> *No fakes. No fraud. No doubt.*

A full-stack C2C marketplace with auctions, offers, Stripe payments, and a seller analytics dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, Recharts, Stripe Elements |
| Backend | Django 5, Django REST Framework, SimpleJWT |
| Database | PostgreSQL |
| Payments | Stripe (PaymentIntent + Webhooks) |
| Email | Django email backend (console dev / SMTP prod) |
| Deploy | Frontend → Vercel · Backend → Railway |

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL running locally

### 1. Clone & set up backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your values (DATABASE_URL, STRIPE keys, etc.)

# Create database
createdb sellit

# Run migrations
python manage.py migrate

# Seed categories
python manage.py seed_categories

# Create superuser (for /admin)
python manage.py createsuperuser

# Start dev server
python manage.py runserver
```

The backend will be available at `http://localhost:8000`.
Django admin at `http://localhost:8000/admin/`.

### 2. Set up frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env:
#   VITE_API_BASE_URL=http://localhost:8000
#   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Start dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## Environment Variables

### Backend `.env`
```
SECRET_KEY=your-django-secret-key
DEBUG=True
DATABASE_URL=postgresql://user:password@localhost:5432/sellit
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your@email.com
EMAIL_HOST_PASSWORD=yourapppassword
FRONTEND_URL=http://localhost:5173
ALLOWED_HOSTS=localhost,127.0.0.1
```

### Frontend `.env`
```
VITE_API_BASE_URL=http://localhost:8000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## Critical User Flows

### Register → Verify → Login
1. `POST /api/auth/register/` → verification email sent (check console in dev)
2. Click link → `GET /api/auth/verify-email/?token=<uuid>`
3. `POST /api/auth/login/` → get `access` + `refresh` tokens

### Seller: Create Listing
1. Register/login as role=seller
2. Go to `/seller/listings/new`
3. Fill form, upload images, submit

### Buyer: Submit Offer → Seller Accepts → Pay
1. Register/login as role=buyer
2. Browse to a negotiable listing
3. Submit offer
4. Seller accepts from `/seller/offers`
5. Order created → buyer redirected to `/checkout/:orderId`
6. Use test card `4242 4242 4242 4242`, any future date, any CVC
7. Webhook fires → order marked paid → receipt created → emails sent

### Auction Flow
1. Seller creates listing with `auction_end_time` set
2. Buyers place bids (each must exceed current highest)
3. Live countdown on listing page
4. When timer expires: highest bidder wins → Order + PaymentIntent auto-created

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register/` | None | Register |
| POST | `/api/auth/login/` | None | Login (get JWT) |
| GET | `/api/auth/me/` | JWT | Get current user |
| GET | `/api/listings/` | None | Browse/search listings |
| POST | `/api/listings/` | Seller | Create listing |
| POST | `/api/listings/:id/images/` | Owner | Upload image |
| GET | `/api/listings/:id/related/` | None | Recommendations |
| GET/POST | `/api/listings/:id/offers/` | JWT | View/submit offers |
| PATCH | `/api/listings/offers/:id/` | Seller | Accept/reject offer |
| GET/POST | `/api/listings/:id/bids/` | JWT | View/place bids |
| GET | `/api/orders/` | JWT | Order history |
| POST | `/api/payments/create-intent/` | JWT | Create Stripe intent |
| POST | `/api/payments/webhook/` | Stripe | Webhook handler |
| GET | `/api/analytics/revenue/` | Seller | Revenue stats |
| GET | `/api/analytics/search-trends/` | Seller | Search analytics |

---

## Deployment

### Frontend → Vercel

1. Push `frontend/` to GitHub
2. Vercel → New Project → Import repo
3. Set root directory: `frontend/`
4. Add env var: `VITE_API_BASE_URL=https://your-backend.railway.app`
5. Deploy

### Backend → Railway

1. Railway → New Project → Deploy from GitHub
2. Root directory: `backend/`
3. Add env vars (all from `.env.example` with production values)
4. Add PostgreSQL add-on (Railway provides free tier)
5. Railway auto-runs `release: python manage.py migrate` from Procfile
6. Set `ALLOWED_HOSTS` to include your Railway domain
7. Set `CORS_ALLOWED_ORIGINS` to your Vercel frontend URL

### Stripe Webhooks

1. Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://your-backend.railway.app/api/payments/webhook/`
3. Event: `payment_intent.succeeded`
4. Copy signing secret → add as `STRIPE_WEBHOOK_SECRET` in Railway env

---

## Django Admin

Access at `/admin/` with your superuser credentials.

Registered models:
- **Users** — list, ban/unban, filter by role/verification
- **Listings** — with inline images, filter by status/condition
- **Offers** — filter by status
- **Bids** — full bid history
- **Orders** — with payment status
- **Payments** — Stripe intent IDs
- **Receipts** — issued receipts
- **EmailLog** — all sent emails with status

---

## Test Stripe Cards

| Card | Outcome |
|---|---|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0025 0000 3155` | 3D Secure required |

Use any future expiry date and any 3-digit CVC.

---

## Project Structure

```
sellit/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── Procfile
│   ├── .env.example
│   ├── sellit/          # Django project config
│   ├── users/           # Auth, user model
│   ├── listings/        # Listings, offers, bids, categories
│   ├── orders/          # Orders, payments, receipts
│   ├── analytics/       # Search trends, revenue views
│   └── notifications/   # EmailLog, email utils
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── .env.example
    └── src/
        ├── api/         # Axios + all API calls
        ├── context/     # AuthContext (JWT)
        ├── components/  # Navbar, ListingCard, Countdown, etc.
        └── pages/       # All route pages
```
