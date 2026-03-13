# รายงาน Environment Variables — .env.local

ตรวจสอบจาก `.env.local`, `.env.local.example` และ `process.env` ใน `src/lib` + `src/app/api` + `src/worker`

---

## ตารางสรุป

| Variable | มีใน .env.local | จำเป็นไหม | ใช้ทำอะไร | ที่มาถ้าขาด |
|----------|-----------------|------------|-----------|-------------|
| **SESSION_SECRET** | ✅ | จำเป็น | JWT สำหรับ session (login) | สร้างเอง — อย่างน้อย 32 ตัวอักษร |
| **FIREBASE_SERVICE_ACCOUNT_PATH** | ✅ | จำเป็น | path ไปไฟล์ JSON service account | **Firebase Console** → Project Settings → Service accounts → Generate new private key |
| **LINE_CHANNEL_SECRET** | ✅ | จำเป็น | ตรวจสอบ signature เว็บฮุก LINE | **LINE Developers Console** → Channel → Messaging API tab |
| **LINE_CHANNEL_ACCESS_TOKEN** | ✅ | จำเป็น | ส่งข้อความกลับ LINE | **LINE Developers Console** → Channel → Messaging API → Channel access token |
| **LINE_ORG_ID** | ✅ | ถ้า multi-tenant | ผูก LINE กับ org เฉพาะ (ส่งข้อความ) | ใส่ org_id ของคลินิกที่ต่อ LINE |
| **OPENAI_API_KEY** | ✅ | จำเป็น | AI (Intent, Compose, Embedding, Chat fallback) | **OpenAI** → API keys → https://platform.openai.com/api-keys |
| **GEMINI_API_KEY** | ✅ | แนะนำ | Core Brain, Summary, Learning quality | **Google AI Studio** → https://aistudio.google.com/apikey |
| **CHAT_PROVIDER** | ✅ | ไม่บังคับ | openai \| gemini \| auto | เลือกเอง (default: auto) |
| **CHAT_USE_PIPELINE** | ✅ | ไม่บังคับ | ใช้ Pipeline หรือ chat agent เดิม | เลือกเอง (default: true) |
| **USE_CORE_BRAIN** | ❌ | ไม่บังคับ | ใช้ Core Brain (Gemini) แทน Role Manager | เลือกเอง; ถ้ามี GEMINI_API_KEY จะใช้ได้อัตโนมัติ |
| **PINECONE_API_KEY** | ✅ | จำเป็น | Vector DB สำหรับ knowledge RAG | **Pinecone** → https://app.pinecone.io → API Keys |
| **PINECONE_INDEX_NAME** | ❌ | ไม่บังคับ | ชื่อ index (default: clinic-knowledge) | ใช้ default ได้ |
| **PINECONE_FAILOVER_INDEX** | ❌ | ไม่บังคับ | Failover index | Pinecone Console |
| **PINECONE_HOST** | ❌ | ไม่บังคับ | Primary API host | ใช้ default |
| **PINECONE_FAILOVER_HOST** | ❌ | ไม่บังคับ | Failover host | Pinecone Console |
| **STRIPE_SECRET_KEY** | ✅ | จำเป็น | ชำระเงิน, subscription | **Stripe Dashboard** → Developers → API keys |
| **STRIPE_WEBHOOK_SECRET** | ✅ | จำเป็น | ตรวจสอบ webhook Stripe | **Stripe Dashboard** → Webhooks → Add endpoint → Signing secret |
| **STRIPE_PRICE_PROFESSIONAL** | ✅ | จำเป็น | Price ID แผน Professional | **Stripe Dashboard** → Products → สร้าง Product + Price |
| **STRIPE_PRICE_MULTI_BRANCH** | ❌ | ถ้ามี Multi Branch | Price ID แผน Multi Branch | Stripe Dashboard |
| **STRIPE_PRICE_ENTERPRISE** | ❌ | ถ้ามี Enterprise | Price ID แผน Enterprise | Stripe Dashboard |
| **NEXT_PUBLIC_APP_URL** | ✅ | แนะนำ | Base URL เว็บ (ลิงก์ verify, checkout ฯลฯ) | Local: http://localhost:3000; Production: https://your-domain.com |
| **RESEND_API_KEY** | ✅ | ถ้าส่งอีเมล | ส่งอีเมล (verify, invite, notification) | **Resend** → https://resend.com/api-keys |
| **EMAIL_FROM** | ❌ | ไม่บังคับ | อีเมลผู้ส่ง (default: onboarding@resend.dev) | Resend |
| **NEXT_PUBLIC_FIREBASE_API_KEY** | ✅ | ถ้าใช้ Realtime | Firebase Client — Realtime listeners (Customers & Chat) | **Firebase Console** → Project Settings → Your apps → Web app config |
| **NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN** | ✅ | ถ้าใช้ Realtime | authDomain | Firebase Console |
| **NEXT_PUBLIC_FIREBASE_PROJECT_ID** | ✅ | ถ้าใช้ Realtime | projectId | Firebase Console |
| **NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET** | ✅ | ถ้าใช้ Realtime | storageBucket | Firebase Console |
| **NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID** | ✅ | ถ้าใช้ Realtime | messagingSenderId | Firebase Console |
| **NEXT_PUBLIC_FIREBASE_APP_ID** | ✅ | ถ้าใช้ Realtime | appId | Firebase Console |
| **FIREBASE_PROJECT_ID** | ❌ | ถ้าไม่ใช้ไฟล์ JSON | ทางเลือกที่ 2 สำหรับ Firebase Admin | ดึงจาก service account JSON |
| **FIREBASE_CLIENT_EMAIL** | ❌ | ถ้าไม่ใช้ไฟล์ JSON | ทางเลือกที่ 2 | ดึงจาก service account JSON |
| **FIREBASE_PRIVATE_KEY** | ❌ | ถ้าไม่ใช้ไฟล์ JSON | ทางเลือกที่ 2 | ดึงจาก service account JSON |
| **FIREBASE_STORAGE_BUCKET** | ❌ | ไม่บังคับ | ถ้า service account ไม่มี project_id | Firebase Console |
| **ADDRESS_PHONE_VERIFICATION_ENABLED** | ✅ | ไม่บังคับ | เปิด/ปิดยืนยันที่อยู่-เบอร์ (Franchise) | เลือกเอง |
| **RETRAIN_NOTIFY_EMAIL** | ✅ | ถ้าใช้ Retrain | อีเมล super_admin รับแจ้ง Retrain | อีเมลของคุณ |
| **SUPER_ADMIN_EMAIL** | ❌ | ไม่บังคับ | อีเมล super_admin สำหรับ notification | fallback ใช้ RETRAIN_NOTIFY_EMAIL |
| **REDIS_URL** | ❌ | ถ้ารัน Workers | BullMQ: chat-llm, handoff-reminder, billing, webhook-retry, knowledge-learning, quota-check ฯลฯ | **Redis** — local: redis://localhost:6379 หรือ Redis Cloud / Upstash |
| **CRON_SECRET** | ❌ | ถ้าใช้ Cron | ป้องกัน cron retrain-monitor / retrain-record | สร้าง secret เอง |
| **MAX_DAILY_LLM_COST_BAHT** | ❌ | ไม่บังคับ | จำกัดค่า AI ต่อวัน (บาท) | เลือกเอง เช่น 500 |
| **GLOBAL_AI_DISABLED** | ❌ | ไม่บังคับ | ปิด AI ทั้งระบบ (emergency) | เลือกเอง |
| **CHAT_MAX_CONCURRENT** | ❌ | ไม่บังคับ | จำกัด concurrent chat (default: 10) | เลือกเอง |
| **CHAT_MAX_CONCURRENT_PER_ORG** | ❌ | ไม่บังคับ | จำกัดต่อ org (default: 5) | เลือกเอง |
| **CHAT_USE_7_AGENT** | ❌ | ไม่บังคับ | ใช้ 7-Agent Orchestrator | เลือกเอง |
| **KNOWLEDGE_WASHING_MACHINE_ENABLED** | ❌ | ไม่บังคับ | Feature flag | เลือกเอง |
| **PLATFORM_MANAGED_MODE_ENABLED** | ❌ | ไม่บังคับ | Feature flag | เลือกเอง |
| **KNOWLEDGE_BRAIN_EMBEDDING_MODEL** | ❌ | ไม่บังคับ | โมเดล embedding (default: text-embedding-3-large) | OpenAI |
| **ENABLE_LLM_JUDGE** | ❌ | ไม่บังคับ | เปิด LLM Judge (default: true) | เลือกเอง |
| **RATE_LIMIT_USE_FIRESTORE** | ❌ | ไม่บังคับ | ใช้ Firestore แทน Redis สำหรับ rate limit | เลือกเอง |
| **HSS_VERIFY_ENABLED** | ❌ | ไม่บังคับ | เปิดยืนยัน HSS (Franchise) | เลือกเอง |
| **HSS_VERIFY_SEARCH_URL** | ❌ | ถ้า HSS เปิด | URL ค้นหา HSS | จากระบบ HSS |
| **EXTERNAL_MAIN_BRANCH_VERIFY_URL** | ❌ | ไม่บังคับ | URL ยืนยันสาขาหลัก (Franchise) | เลือกเอง |
| **GLOBAL_LLM_MAX** | ❌ | ไม่บังคับ | จำกัด LLM global (Enterprise hardening) | เลือกเอง |
| **PER_ORG_LLM_MAX** | ❌ | ไม่บังคับ | จำกัดต่อ org | เลือกเอง |
| **LLM_SLOT_TTL_SEC** | ❌ | ไม่บังคับ | TTL ของ slot (วินาที) | เลือกเอง |
| **OBS_LOG_FIRESTORE** | ❌ | ไม่บังคับ | Log observability ลง Firestore | เลือกเอง |
| **OBS_LOG_TO_CONSOLE** | ❌ | ไม่บังคับ | Log ไป console | เลือกเอง |
| **OBS_ENDPOINT** | ❌ | ไม่บังคับ | Observability endpoint | เลือกเอง |
| **OBS_LOG_CACHE** | ❌ | ไม่บังคับ | Log cache metrics | เลือกเอง |
| **OBSERVABILITY_LOG** | ❌ | ไม่บังคับ | เปิด log observability | เลือกเอง |
| **NODE_ENV** | (ระบบ) | — | development / production | ตั้งโดย Next.js อัตโนมัติ |
| **VERCEL_URL** | (ระบบ) | ไม่บังคับ | URL บน Vercel | ตั้งโดย Vercel อัตโนมัติ |

---

## สรุป: ตัวแปรที่ขาดใน .env.local

### ควรเพิ่มถ้าใช้งาน

| Variable | ที่มาถ้าขาด |
|----------|-------------|
| **REDIS_URL** | **Redis** — ติดตั้ง Redis local (`redis://localhost:6379`) หรือใช้ Redis Cloud / Upstash. จำเป็นถ้ารัน workers (chat-llm, handoff-reminder, billing, webhook-retry, knowledge-learning) |
| **STRIPE_PRICE_MULTI_BRANCH** | **Stripe Dashboard** → Products → สร้าง Product แผน Multi Branch → คัดลอก Price ID |
| **STRIPE_PRICE_ENTERPRISE** | **Stripe Dashboard** → Products → สร้าง Product แผน Enterprise → คัดลอก Price ID |
| **CRON_SECRET** | สร้าง random string เอง — ใส่ใน Vercel Cron env และส่งเป็น header เมื่อเรียก retrain-monitor |

### ตัวแปรเสริม (ไม่จำเป็น)

- `USE_CORE_BRAIN`, `EMAIL_FROM`, `SUPER_ADMIN_EMAIL`, `MAX_DAILY_LLM_COST_BAHT`
- `PINECONE_INDEX_NAME`, `KNOWLEDGE_BRAIN_EMBEDDING_MODEL`
- Feature flags และ observability ต่างๆ

---

## สถานะ .env.local ปัจจุบัน

**ครบสำหรับการใช้งานหลัก:** Login, LINE Bot, AI Pipeline, Stripe (Professional), Pinecone, Resend, Firebase Admin + Client

**ยังไม่มี (ถ้าต้องการ):**
- `REDIS_URL` — ถ้าจะรัน workers
- `STRIPE_PRICE_MULTI_BRANCH`, `STRIPE_PRICE_ENTERPRISE` — ถ้ามีแผน Multi Branch / Enterprise
- `CRON_SECRET` — ถ้าใช้ Vercel Cron retrain
