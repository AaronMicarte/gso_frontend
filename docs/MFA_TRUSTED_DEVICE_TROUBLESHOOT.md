# Trusted Device Troubleshooting (Dev)

Short guide to test and debug "Trust this device" behavior locally.

## Quick checklist
- Ensure you checked **Trust this device** during verification.
- After successful MFA, look for `device_token` in the JSON response (one-time) and in DevTools → Application → Cookies.
- Cookie name: `device_token`, httpOnly, expiry ≈ 30 days.

## Local scenarios & recommendations

1) Same-origin local development (recommended for easiest testing)
- Run frontend and backend under the same origin (e.g., reverse proxy or same host/port). Cookies will be set with SameSite=Lax and Secure=false and should work on HTTP.

2) Cross-origin local development (frontend and backend on different origins)
- Browsers require **SameSite=None; Secure** for cross-site cookies. Secure requires HTTPS.
- Options:
  - Expose your backend with ngrok (HTTPS) and point the frontend to the ngrok URL. Example:
    - ngrok http 8000
    - Set NEXT_PUBLIC_API_URL to the ngrok URL in frontend .env
  - Use mkcert / local-ssl-proxy to enable HTTPS locally for both frontend and backend.

## Quick ngrok example
1. Start backend: php artisan serve --port=8000
2. Start ngrok: ngrok http 8000
3. Set frontend environment: NEXT_PUBLIC_API_URL=https://<ngrok-id>.ngrok.io
4. Restart frontend and test: complete MFA and check Cookies.

## Debug logging (dev)
- The backend now writes a small debug log entry when creating/validating trusted devices. Check `storage/logs/laravel.log` for entries containing `trusted-device`.

## Common problems
- No `device_token` cookie visible: likely blocked due to cross-site rules or missing Secure flag on HTTPS.
- Cookie present but still being asked for MFA: the token may be expired, or the cookie is not sent to the backend (check network request headers for Cookie).

If you want, I can add a small script to automate ngrok setup and a checklist to `README.md`.