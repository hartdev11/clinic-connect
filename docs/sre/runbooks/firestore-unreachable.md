# Runbook: Firestore Unreachable

## Trigger
- `/api/health/ready` returns 503 with `firestore` failed
- Admin service health reports Firestore down

## Immediate Checks
1. Confirm `/api/health/live` still returns 200 (process alive)
2. Confirm `/api/health/ready` returns 503
3. Verify Google Cloud incident status for Firestore

## Triage
- Scope affected APIs (booking, auth, analytics, webhook handlers)
- Inspect recent deploys or credential changes
- Validate service account/key environment integrity

## Mitigation
- Pause non-critical write-heavy jobs/workers
- Enable graceful degradation in user-facing flows
- Communicate incident status and ETA to support channels

## Recovery
- Re-test `/api/health/ready` until 200
- Run targeted sanity checks:
  - login
  - booking create
  - webhook retry queue
- Close incident only after 30 minutes stable

