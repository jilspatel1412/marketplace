# SellIt — Marketplace

A full-stack peer-to-peer marketplace built with Django and React.

---

## Requirements

- Python 3.11+
- Node.js 18+
- PostgreSQL

---

## How to Run

You need **two terminals** open at the same time.

---

### Terminal 1 — Backend

```bash
cd backend

# Create virtual environment (first time only)
python -m venv venv

# Activate it
source venv/bin/activate        # Mac / Linux
venv\Scripts\activate           # Windows

# Install dependencies (first time only)
pip install -r requirements.txt

# Create a .env file in the backend/ folder with:
# SECRET_KEY=any-random-string
# DEBUG=True
# DATABASE_URL=postgresql://user:password@localhost:5432/sellit
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
# FRONTEND_URL=http://localhost:5173
# ALLOWED_HOSTS=localhost,127.0.0.1

# Run migrations (first time only)
python manage.py migrate

# Start the server
python manage.py runserver
```

Backend runs at: `http://localhost:8000`

---

### Terminal 2 — Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Create a .env file in the frontend/ folder with:
# VITE_API_BASE_URL=http://localhost:8000
# VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Start the dev server
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## Test Stripe Cards

Use these on the checkout page:

| Card Number | Result |
|---|---|
| `4242 4242 4242 4242` | Payment success |
| `4000 0000 0000 0002` | Card declined |

Any future expiry date, any 3-digit CVC.

---

## Admin Panel

Create a superuser to access `/admin/`:

```bash
cd backend
source venv/bin/activate
python manage.py createsuperuser
```

Then go to `http://localhost:8000/admin/`
