# Observability — Routes Wrapped with runWithObservability

## Wrapped (clinic) — 31 route files

- **analytics**: overview, branch-performance, alerts, comparison, operational, knowledge, revenue, conversation, ai-performance, executive-summary
- **dashboard**
- **bookings**: route (GET, POST), [id] (PATCH), calendar, timeline, slots, queue, day-timeline, reports
- **promotions**: route (GET, POST, PATCH, DELETE)
- **users**: route (GET, POST)
- **finance**, **me**, **context**
- **customers**: route (GET)
- **feedback**: route (GET)
- **organization**: route (PATCH)
- **branches**: route (GET, POST)
- **notifications**: route (GET)
- **line**: route (GET, PUT)
- **knowledge**: route (POST)

## Wrapped (internal)

- **internal/ai-context** (GET)

## Excluded

- **internal/observability/summary** — do not wrap (observer endpoint)

## Remaining to wrap (clinic) — ~41 route files

- promotions/upload-temp, scan-image, from-scan, [id]/cover, [id]/media
- invoices/[id], [id]/refunds, [id]/confirm-payment
- doctor-schedules, doctor-schedules/[id], doctor-schedules/[id]/get
- ai/availability
- blackout-dates, blackout-dates/[id]
- branches/[id], branches/[id]/hours
- slot-settings
- knowledge-brain/clinic, submit/[id], reject/[id], clinic/[id], approve/[id], versions, audit, rollback, reindex, global
- feedback/[id]
- notifications
- customers/[id]/soft-delete, refresh-profile, chats, send-message
- debug-org, line, users/[id], knowledge, checkout, checkout/verify, checkout/preview, subscription
