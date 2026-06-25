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

### Resend API settings (.env)

2FA email delivery now uses Resend API only.

Add these values to backend/.env:

- `RESEND_API_KEY=...`
- `RESEND_FROM=Virtual Court <noreply@your-domain.com>`
- `ALLOW_DEV_2FA_FALLBACK` (optional, default `false`; set to `true` only for local dev to expose `development_code` if email fails)

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
	- In local/dev when Resend is not configured and `ALLOW_DEV_2FA_FALLBACK=true`, response includes `development_code`.
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