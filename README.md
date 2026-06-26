# Setup

## Frontend

cd frontend
npm install
npm run dev

## Backend

cd backend
npm install
npm install node
npm start

## Database

Create PostgreSQL database:

virtualcourt

Run:

database/schema.sql

Create:

backend/.env

## Two-Factor Authentication (2FA)

2FA is supported using email OTP (a 6-digit code sent to the user's email).

### 2FA email providers (.env)

2FA email delivery uses Brevo API.

Fallback behavior:

1. Brevo API delivery

Brevo settings:

- `BREVO_API_KEY=...`
- `BREVO_FROM_EMAIL=you@your-email.com`
- `BREVO_FROM_NAME=Virtual Court` (optional)

### API flow

1. Login normally to get your auth token.
2. Setup 2FA:
	- `POST /api/auth/2fa/setup` (Bearer token required)
	- Prepares account for email OTP mode.
3. Enable 2FA:
	- `POST /api/auth/2fa/enable` (Bearer token required)

### Login flow with 2FA enabled

1. `POST /api/auth/login` with email/password.
2. If 2FA is enabled, response contains:
	- `requires_2fa: true`
	- `two_factor_token`
	- Delivery diagnostics: `email_delivery`, `email_delivery_provider`, `email_delivery_reason`, `email_delivery_detail`
3. Submit OTP code:
	- `POST /api/auth/login/2fa` with body `{ "two_factor_token": "...", "code": "123456" }`
4. Resend OTP code:
	- `POST /api/auth/login/2fa/resend` with body `{ "two_factor_token": "..." }`

### Frontend flow

- Login page submits credentials.
- If `requires_2fa` is returned, user is routed to `/login/2fa`.
- `/login/2fa` page handles code verification and resend.

### Disable 2FA

- `POST /api/auth/2fa/disable` (Bearer token required)