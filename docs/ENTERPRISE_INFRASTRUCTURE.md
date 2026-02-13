# Enterprise Infrastructure

## Horizontal Scaling

- **Stateless API**: ทุก API route ไม่เก็บ state ใน memory
- **Distributed Rate Limit**: ใช้ Firestore (`rate_limit_sliding`) — รองรับ multi-instance
- **Session**: JWT ใน HttpOnly cookie — ไม่ต้องใช้ sticky session

## Background Jobs

- **Cron**: ใช้ `POST /api/admin/cleanup` เรียกจาก external cron (Vercel Cron, GitHub Actions, etc.)
- **Cleanup รายการ**: LLM usage, rate limit, line webhook, stripe events, audit_logs

## Webhook Verification

- **LINE**: `verifyLineSignature(body, x-line-signature, channelSecret)` — HMAC-SHA256
- **Stripe**: `stripe.webhooks.constructEvent(body, stripe-signature, secret)` — Ed25519
