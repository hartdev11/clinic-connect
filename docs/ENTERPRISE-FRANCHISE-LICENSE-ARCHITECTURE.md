# 🚀 CLINIC CONNECT — ENTERPRISE FRANCHISE & LICENSE ARCHITECTURE

**Version: 1.0 (Authoritative – No Further Structural Changes Required)**  
เอกสารนี้เป็น master spec สำหรับการยกระดับเป็นแพลตฟอร์ม franchise & license — ต้องปฏิบัติตามหลักการด้านล่างทุกครั้งที่ออกแบบหรือ implement

---

## 🎯 SYSTEM OBJECTIVE

Transform Clinic Connect into a **fully enterprise-grade, multi-tenant SaaS platform** supporting:

| เป้าหมาย | ความหมาย |
|----------|----------|
| **License-based activation** | เปิดใช้ระบบด้วย license (ไม่ใช่แค่ login) — license เป็นตัว “เปิดสิทธิ์ใช้” |
| **Single clinic mode** | โหมดคลินิกเดี่ยว (ไม่ใช่ franchise) ยังรองรับได้ |
| **Franchise HQ + branch architecture** | โครงสร้างสำนักงานใหญ่ (HQ) + สาขา — HQ กับ branch แยกบทบาทชัด |
| **Branch-first subscription scenario** | สมัครสมาชิก/ subscription อาจเริ่มที่ระดับสาขา (branch-first) |
| **Claim governance flow** | มี flow การ “claim” (เช่น สาขา claim เข้า franchise, หรือการยืนยันสิทธิ์) ต้องมี governance ชัดเจน |
| **Invite-only branch expansion** | การเพิ่มสาขาเป็นแบบ invite-only (ไม่ใช่ใครก็สร้างสาขาได้) |
| **Cross-branch analytics (HQ only)** | ดู analytics ข้ามสาขาได้เฉพาะ HQ |
| **Strict tenant isolation** | แยกข้อมูลระหว่าง tenant เข้มงวด — ไม่มีข้อมูลรั่วข้าม tenant |
| **Plan quota enforcement** | บังคับโควตาตาม plan (จำนวนสาขา, จำนวนผู้ใช้ ฯลฯ) |
| **Stripe-based license issuance** | ออก license ผ่าน Stripe (ซื้อ/ต่ออายุ license ผ่าน Stripe) |
| **Backward compatibility** | ต้องไม่ทำลายพฤติกรรมเดิมของคลินิกที่ใช้อยู่แล้ว |
| **Zero AI pipeline modification** | ห้ามเปลี่ยน flow หรือลำดับใน AI pipeline |
| **Production-safe migration** | migration ต้องปลอดภัย ใช้ได้ใน production |
| **TypeScript + existing test suite** | ต้องผ่าน type check และชุดเทสเดิม |

---

## 🧱 ARCHITECTURAL PRINCIPLES (NON-NEGOTIABLE)

หลักการเหล่านี้ **ห้ามละเมิด** ไม่ว่าในขั้นออกแบบหรือ implement:

1. **License ≠ Authentication**
   - License = การ “เปิดสิทธิ์ใช้ระบบ/ฟีเจอร์” (activation, entitlement)
   - Authentication = การ “พิสูจน์ตัวตน” (login, session)
   - สองอย่างแยกกัน ไม่รวมเป็นขั้นตอนเดียว

2. **No physical merging of organizations**
   - ไม่มีการ merge องค์กร (org) เป็นหนึ่งตัวในฐานข้อมูล
   - แต่ละ org ยังเป็น document/record แยก

3. **Grouping is logical via `franchise_group_id`**
   - การจัดกลุ่ม franchise ทำผ่านฟิลด์เชิงลอจิก เช่น `franchise_group_id` (หรือเทียบเท่า)
   - ไม่ merge document; link กันด้วย ID

4. **All enforcement must occur in backend**
   - การบังคับสิทธิ์, โควตา, การเข้าถึงข้ามสาขา ต้องทำที่ backend เท่านั้น
   - Frontend แสดง/ซ่อนได้ แต่การตัดสินใจ “ได้หรือไม่ได้” ต้องที่ API

5. **No raw license key storage**
   - ไม่เก็บ license key แบบ plain text
   - ต้อง hash หรือ encrypt ตาม best practice

6. **AI pipeline execution order MUST NOT change**
   - ลำดับใน `src/lib/agents/pipeline.ts` (Intent → Safety → Escalation → Knowledge → Compose) **ห้ามเปลี่ยน**
   - สอดคล้องกับ GLOBAL-GUARDRAILS ที่มีอยู่

7. **RBAC must remain authoritative**
   - สิทธิ์การเข้าถึงยังตัดที่ RBAC (owner, manager, staff, branch_roles) เป็นหลัก
   - License / franchise ไม่แทนที่ RBAC แต่ทำงานร่วมกัน

8. **No cross-tenant data leakage under any circumstance**
   - ข้อมูลของ tenant A ห้ามไปถึง tenant B
   - ทุก query/API ต้อง scoped ด้วย org_id (และ branch_id / franchise_group_id ตามที่ออกแบบ)

---

## 📌 USE OF THIS DOCUMENT

- เมื่อออกแบบฟีเจอร์ franchise / license / HQ-branch ให้ตรวจว่าตรงกับหลักการด้านบน
- เมื่อ implement: ตรวจสอบ tenant isolation, no pipeline change, no raw license storage, enforcement ใน backend
- เมื่อ review: ใช้หลักการนี้เป็น checklist

---

*Document created for Cursor/agent and team reference. Aligns with existing GLOBAL-GUARDRAILS and PROJECT-SUMMARY.*
