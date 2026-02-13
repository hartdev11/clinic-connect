# FE-4 — Knowledge Management UI

## สรุป

- **Smart Knowledge Input Form**: topic, category, key_points, content
- **Duplicate Warning UI**:
  - Exact match → block (แสดง error, ปิดปุ่มบันทึก)
  - Semantic similarity > 0.85 → modal ให้เลือก Replace/Keep/Cancel
- **Knowledge Washing Machine**: Toggle สำหรับ Enterprise plan (ยังไม่ implement)

## Implementation

| ไฟล์ | บทบาท |
|------|--------|
| `src/app/(clinic)/clinic/knowledge/page.tsx` | Knowledge Input Form (upgrade จากเดิม) |
| `src/components/clinic/DuplicateWarningModal.tsx` | Modal สำหรับ semantic duplicate |
| `src/lib/feature-flags.ts` | isKnowledgeWashingMachineEnabled() |

## Flow

1. **Structured Input** — กรอก topic, category, key_points, content
2. **Duplicate Check** — เรียก API → backend ตรวจ exact + semantic
3. **Conflict Resolution**:
   - Exact match → block (แสดง error card, ปิดปุ่มบันทึก)
   - Semantic > 0.85 → แสดง modal ให้เลือก Replace/Keep/Cancel
4. **Save** — บันทึก → Embed → Vector DB

## Knowledge Washing Machine

- **Starter/Professional**: ❌ ไม่แสดง toggle
- **Enterprise**: ✅ แสดง toggle (ยังไม่ implement — design only)

## UI Improvements

- Exact match → แสดง error card สีแดง, ปิดปุ่มบันทึก
- Semantic duplicate → Modal overlay แทน inline card
- Knowledge Washing Machine toggle → แสดงเฉพาะ Enterprise
