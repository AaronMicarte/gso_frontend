# Turnstile Production Deployment Guide

This document is your deployment checklist for Cloudflare Turnstile in the GSO system.

Use this guide when deploying to production so captcha protection stays enabled and correctly validated on the backend.

## 1) Scope

Turnstile is currently enforced for these public authentication flows:
- Login
- Account activation
- MFA verification

Frontend renders the widget and sends a token.
Backend verifies the token server-side using Cloudflare siteverify API.

## 2) Prerequisites

Before deployment, prepare:
- Cloudflare account with Turnstile enabled
- Production frontend domain (example: app.example.gov.ph)
- Production backend API base URL
- Access to production environment variables
- Access to backend restart and cache clear commands

## 3) Cloudflare Setup

1. Open Cloudflare Turnstile dashboard.
2. Create or edit a widget for production.
3. Set widget mode to Managed.
4. Allowed domains must include your exact production frontend host.
   - Example: app.example.gov.ph
5. Save and copy:
   - Site Key
   - Secret Key

Important:
- Site Key is public and used by frontend.
- Secret Key must stay private on backend only.

## 4) Environment Variables

## 4.1 Frontend

Set these in frontend production env:

- NEXT_PUBLIC_API_URL=https://your-api-domain/api
- NEXT_PUBLIC_API_BASE_URL=https://your-api-domain
- NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key

## 4.2 Backend

Set these in backend production env:

- TURNSTILE_ENABLED=true
- TURNSTILE_SECRET_KEY=your_turnstile_secret_key
- TURNSTILE_VERIFY_URL=https://challenges.cloudflare.com/turnstile/v0/siteverify
- TURNSTILE_EXPECTED_HOSTNAME=your_frontend_domain

Example:
- TURNSTILE_EXPECTED_HOSTNAME=app.example.gov.ph

Notes:
- Keep TURNSTILE_ENABLED=true in production.
- TURNSTILE_EXPECTED_HOSTNAME should be set in production.
- For local development it can be empty.

## 5) Deployment Steps

1. Deploy frontend with updated env variables.
2. Deploy backend with updated env variables.
3. On backend, clear config and cache:

Windows XAMPP example:
- c:\xampp\php\php.exe artisan config:clear
- c:\xampp\php\php.exe artisan cache:clear

Linux example:
- php artisan config:clear
- php artisan cache:clear

4. Restart backend PHP service/process.
5. Restart frontend process/service.

## 6) Post-Deployment Verification (Strict)

Run this in browser DevTools Network on production:

1. Open login page in incognito.
2. Ensure captcha widget appears.
3. Submit login with valid captcha token.
4. Confirm request payload contains turnstile_token.
5. Confirm response is normal auth behavior (not turnstile_failed).

Negative test (proof of backend enforcement):
1. Copy login request as fetch.
2. Replace turnstile_token with FAKE_TOKEN_123.
3. Execute in console.
4. Expected:
   - HTTP 422
   - JSON includes turnstile_failed=true

Repeat same proof for:
- MFA verify endpoint
- Account activation endpoint

## 7) Security Hardening Checklist

- Set TURNSTILE_EXPECTED_HOSTNAME in production.
- Rotate Turnstile secret key if previously exposed.
- Do not commit .env files to git.
- Keep login rate limits enabled.
- Monitor repeated turnstile_failed responses.
- Keep HTTPS enabled end-to-end.

## 8) Monitoring and Alert Signals

Watch for these patterns in logs:
- Sudden spike in turnstile_failed responses
- Repeated verification-exception errors
- High-volume failed login attempts from same IP ranges

Suggested action thresholds:
- Investigate if turnstile_failed rises above normal baseline
- Investigate immediately if verification-exception appears repeatedly

## 9) Common Problems

Problem: Captcha widget not visible
- Cause: Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY
- Cause: Domain not allowed in Cloudflare widget

Problem: Captcha always fails on backend
- Cause: Wrong TURNSTILE_SECRET_KEY
- Cause: TURNSTILE_ENABLED=true but old config cache still loaded
- Fix: Clear config/cache and restart backend

Problem: Hostname mismatch in production
- Cause: TURNSTILE_EXPECTED_HOSTNAME does not match frontend host
- Fix: Set exact production host

Problem: Console shows PAT challenge 401
- Usually normal Cloudflare internals in some browsers
- Validate using API response behavior, not only console noise

## 10) Rollback Plan (Emergency)

If production auth is blocked and users cannot login:

1. Temporarily set TURNSTILE_ENABLED=false on backend.
2. Clear config/cache and restart backend.
3. Restore login access.
4. Fix key/domain configuration.
5. Re-enable TURNSTILE_ENABLED=true.

Use rollback only as emergency temporary action.

## 11) Final Go-Live Checklist

- Widget domain list includes production host
- Frontend has correct site key
- Backend has correct secret key
- TURNSTILE_ENABLED=true in production
- TURNSTILE_EXPECTED_HOSTNAME set correctly
- Config/cache cleared after env update
- Strict negative test returns 422 turnstile_failed=true
- Positive test reaches normal auth behavior

If all items pass, Turnstile deployment is production-ready.
