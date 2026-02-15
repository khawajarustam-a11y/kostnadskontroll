# Observability Setup

## Structured logs

This project now emits JSON logs with:
- `requestId`
- `route`
- `op`
- `ms`
- `status`

Use `LOG_LEVEL` to control verbosity (`debug`, `info`, `warn`, `error`).

## Sentry

Set these env vars:
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN` (optional, for browser events)
- `SENTRY_ENVIRONMENT`
- `SENTRY_ORG` and `SENTRY_PROJECT` (for source maps in CI)

## Recommended alerts (Vercel/Sentry)

1. **500 error rate**
2. **P95 latency > 1s** for:
   - `/dashboard`
   - `/costs`
   - `/contracts`
   - `/ledger`

