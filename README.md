# SellIt — Marketplace

A full-stack peer-to-peer marketplace built with **Django** (backend) and **React** (frontend).

---

## Prerequisites

Install these before anything else:

| Tool | Version | Download |
|---|---|---|
| Python | 3.11+ | https://www.python.org/downloads/ |
| Node.js | 18+ | https://nodejs.org/ |
| Git | any | https://git-scm.com/downloads |
| PostgreSQL | 15+ | https://www.postgresql.org/download/ |

> **Windows:** During Python install, check **"Add Python to PATH"**.
> **Windows:** During PostgreSQL install, remember the password you set for the `postgres` user.

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/jilspatel1412/marketplace.git
cd marketplace
```

---

## Step 2 — Database Setup (PostgreSQL)

Open **pgAdmin** (installed with PostgreSQL) or use the terminal:

```bash
# Windows — open the psql shell from Start Menu, log in as postgres
psql -U postgres

# Then run:
CREATE DATABASE sellit;
\q
```

---

## Step 3 — Backend Setup

Open a terminal in the project root.

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate          # Windows
source venv/bin/activate       # Mac / Linux

# Install dependencies
pip install -r requirements.txt
```

### Create backend/.env

Create a file called `.env` inside the `backend/` folder with this content:

```
SECRET_KEY=any-long-random-string-change-this
DEBUG=True

DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/sellit

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your_gmail@gmail.com
EMAIL_HOST_PASSWORD=your_gmail_app_password
DEFAULT_FROM_EMAIL=your_gmail@gmail.com

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

FRONTEND_URL=http://localhost:5173
ALLOWED_HOSTS=localhost,127.0.0.1
```

> **Where to get these values:**
> - `SECRET_KEY` — any random string (e.g. `abc123xyz-change-me-please`)
> - `DATABASE_URL` — replace `YOUR_POSTGRES_PASSWORD` with your PostgreSQL password
> - `EMAIL_HOST_PASSWORD` — a Gmail App Password (requires 2FA on your Gmail account, then go to Google Account → Security → App Passwords)
> - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — from https://dashboard.stripe.com/test/apikeys
> - `CLOUDINARY_*` — from https://cloudinary.com (free account, used for image uploads)

### Run Migrations

```bash
python manage.py migrate
```

### Create Admin Account

```bash
python manage.py createsuperuser
```

Follow the prompts. You'll use these credentials to log in to the admin panel.

### Start the Backend Server

```bash
python manage.py runserver
```

Backend runs at: **http://localhost:8000**

---

## Step 4 — Frontend Setup

Open a **second terminal** in the project root.

```bash
cd frontend

# Install dependencies
npm install
```

### Create frontend/.env

Create a file called `.env` inside the `frontend/` folder:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

> Get `VITE_STRIPE_PUBLISHABLE_KEY` from https://dashboard.stripe.com/test/apikeys (the "Publishable key").

### Start the Frontend

```bash
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## Step 5 — Stripe Webhooks (for payments to work locally)

Payments require Stripe to send events to your local backend. Install the Stripe CLI:

- **Windows:** Download from https://github.com/stripe/stripe-cli/releases (`.exe` file)
- **Mac:** `brew install stripe/stripe-cli/stripe`

Then run:

```bash
stripe login
stripe listen --forward-to localhost:8000/api/payments/webhook/
```

Copy the `whsec_...` signing secret it shows and paste it as `STRIPE_WEBHOOK_SECRET` in your `backend/.env`. Restart the backend after changing `.env`.

---

## Running the App

You need **two terminals** running at the same time:

| Terminal | Command | URL |
|---|---|---|
| 1 — Backend | `cd backend && venv\Scripts\activate && python manage.py runserver` | http://localhost:8000 |
| 2 — Frontend | `cd frontend && npm run dev` | http://localhost:5173 |

Open **http://localhost:5173** in your browser.

---

## Admin Panel

Go to **http://localhost:8000/admin** and log in with your superuser credentials.

From there you can:
- View and delete users
- Ban / unban users
- Manually verify email addresses
- View all listings, orders, and payments

---

## Test Stripe Cards

Use these on the checkout page (any future expiry, any 3-digit CVC):

| Card Number | Result |
|---|---|
| `4242 4242 4242 4242` | Payment success |
| `4000 0000 0000 0002` | Card declined |

---

## Project Structure

```
marketplace/
├── backend/          # Django REST API
│   ├── users/        # Auth, registration, profiles
│   ├── listings/     # Listings, bids, offers, images
│   ├── orders/       # Orders, payments, reviews, shipping labels
│   ├── messaging/    # Direct messages between users
│   ├── notifications/# In-app + email notifications
│   └── analytics/    # Search trends, revenue data
└── frontend/         # React (Vite)
    └── src/
        ├── pages/    # All page components
        ├── api/      # Axios API calls
        └── styles.css
```
