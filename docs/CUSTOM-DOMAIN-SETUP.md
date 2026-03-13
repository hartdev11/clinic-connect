# Custom Domain Setup (Phase 20 — White Label)

เอกสารนี้อธิบายวิธีตั้งค่า custom domain สำหรับ Agency (White Label) ให้ผู้ใช้เข้าผ่านโดเมนของตนเอง

## Overview

เมื่อ agency มี `customDomain` (เช่น `app.partner-clinic.com`) ผู้ใช้ที่เข้าผ่านโดเมนนั้นจะเห็น branding ของ agency (logo, สี) แทน branding หลักของ Clinic Connect

## ขั้นตอนที่ 1: DNS (CNAME)

ที่ DNS provider ของโดเมน (เช่น Cloudflare, GoDaddy, Namecheap):

1. สร้าง **CNAME record**:
   - **Name/Host**: subdomain ที่ต้องการ (เช่น `app` สำหรับ `app.partner-clinic.com`)
   - **Value/Points to**: โดเมนหลักของ Vercel app
     - ถ้า deploy บน Vercel: `cname.vercel-dns.com`
     - หรือ domain ที่ Vercel ให้มา เช่น `your-app.vercel.app`

ตัวอย่าง:
```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
```

2. รอ propagation (อาจใช้เวลา 5 นาที – 48 ชั่วโมง)

## ขั้นตอนที่ 2: Vercel Domain Config

1. เข้า **Vercel Dashboard** → โปรเจกต์ Clinic Connect
2. ไปที่ **Settings** → **Domains**
3. เพิ่มโดเมน: กรอก `app.partner-clinic.com` (หรือ subdomain ที่ใช้)
4. คลิก **Add**
5. Vercel จะตรวจสอบ DNS — ถ้า CNAME ชี้ถูกต้องจะแสดง verified

## ขั้นตอนที่ 3: ตั้ง customDomain ใน Agency

1. super_admin สร้าง agency และตั้ง `customDomain` ให้ตรงกับ hostname ที่จะใช้
2. หรือ agency แก้ไข custom domain ได้ที่ **Agency Settings** (`/agency/settings`)

ค่าที่ต้องตั้ง:

- **customDomain** = hostname ที่ผู้ใช้เข้า (เช่น `app.partner-clinic.com`)
- ไม่ใส่ protocol (`https://`) — ใช้เฉพาะ hostname

### ตรวจสอบการ match

ระบบจะใช้ `Host` header ของ request เปรียบเทียบกับ `customDomain` ใน agencies collection ถ้า match และ agency status = `active` จะแสดง branding ของ agency นั้น

## สรุป Checklist

- [ ] สร้าง CNAME record ชี้ไปยัง Vercel
- [ ] เพิ่ม domain ใน Vercel Dashboard
- [ ] รอ DNS propagation และ verification
- [ ] ตั้ง `customDomain` ใน agency ให้ตรงกับ hostname
- [ ] ทดสอบเข้า https://app.partner-clinic.com (หรือ subdomain ที่ใช้)

## หมายเหตุ

- **SSL**: Vercel ออก certificate ให้อัตโนมัติเมื่อ domain ผ่าน verification
- **Root domain** (เช่น `partner-clinic.com`): Vercel รองรับ แต่ต้องใช้ A record ชี้ไปยัง Vercel IP แทน CNAME
- **หลาย agency**: แต่ละ agency ใช้ custom domain คนละอันได้ — ระบบจะ match ตาม hostname
