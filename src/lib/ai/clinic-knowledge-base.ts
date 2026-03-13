/**
 * Clinic Knowledge Base — P1-P4
 * Auto-generated from P1-P4 CSV — ครบทุก row
 * ใช้สำหรับ inject เข้า System Prompt (Role Manager + Core Brain)
 */

// ─────────────────────────────────────────
// P1 — Products ทั้งหมด 182 รายการ
// ─────────────────────────────────────────
export const ALL_PRODUCTS = [
  // === Botox (P001–P009) ===
  { id: "P001", category: "Botox", brand: "Botox Allergan", country: "USA", desc: "Gold standard Botox", use: "หน้าผาก หางตา หมิ่น", price: "8,000-12,000", duration: "4-6 เดือน", popular: "TOP" },
  { id: "P002", category: "Botox", brand: "Nabota", country: "Korea", desc: "ราคาประหยัด คุณภาพดี", use: "หน้าผาก หางตา", price: "6,000-10,000", duration: "4-6 เดือน", popular: "TOP" },
  { id: "P003", category: "Botox", brand: "Dysport", country: "UK", desc: "กระจายดี onset เร็ว", use: "หน้ากว้าง หน้าผาก", price: "7,000-11,000", duration: "4-6 เดือน", popular: "TOP" },
  { id: "P004", category: "Botox", brand: "Xeomin", country: "Germany", desc: "Pure neurotoxin ไม่มี protein", use: "หน้าผาก หางตา", price: "7,000-10,000", duration: "4-6 เดือน", popular: "รอง" },
  { id: "P005", category: "Botox", brand: "Coretox", country: "Korea", desc: "Liquid form ไม่ต้องผสม", use: "หน้าผาก หางตา หมิ่น", price: "6,000-9,000", duration: "4-6 เดือน", popular: "กระแส" },
  { id: "P006", category: "Botox", brand: "Innotox", country: "Korea", desc: "Ready-to-use ไม่ต้องผสมน้ำ", use: "หน้าผาก หางตา", price: "6,000-9,000", duration: "4-6 เดือน", popular: "กระแส" },
  { id: "P007", category: "Botox", brand: "Meditoxin", country: "Korea", desc: "ราคาประหยัด diffusion น้อย", use: "หน้าผาก หางตา", price: "5,500-8,500", duration: "4-6 เดือน", popular: "รอง" },
  { id: "P008", category: "Botox", brand: "Neuronox", country: "Korea", desc: "Freeze-dried ทนทาน", use: "หน้าผาก หางตา", price: "6,000-9,000", duration: "4-6 เดือน", popular: "รอง" },
  { id: "P009", category: "Botox", brand: "Botulax", country: "Korea", desc: "ราคาถูกสุด diffusion มาก", use: "หน้าผาก หางตา", price: "5,000-7,000", duration: "4-6 เดือน", popular: "รอง" },
  // === Filler (P010–P042) ===
  { id: "P010", category: "Filler", brand: "Juvederm Voluma XC", country: "USA", desc: "ยกกระชับแก้ม คาง", use: "แก้ม คาง หน้าผาก", price: "20,000-30,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P011", category: "Filler", brand: "Juvederm Volift XC", country: "USA", desc: "ริ้วรอยลึก ร่องแก้ม", use: "ร่องแก้ม รอบปาก", price: "18,000-25,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P012", category: "Filler", brand: "Juvederm Volbella XC", country: "USA", desc: "ปาก ใต้ตา นุ่ม", use: "ปาก ใต้ตา", price: "15,000-22,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P013", category: "Filler", brand: "Juvederm Ultra Plus XC", country: "USA", desc: "ปาก ร่องแก้ม", use: "ปาก ร่องแก้ม", price: "16,000-23,000", duration: "9-12 เดือน", popular: "รอง" },
  { id: "P014", category: "Filler", brand: "Juvederm Ultra XC", country: "USA", desc: "ผิวตื้น ริ้วรอยเล็ก", use: "ริ้วรอยตื้น", price: "15,000-20,000", duration: "9-12 เดือน", popular: "รอง" },
  { id: "P015", category: "Filler", brand: "Juvederm Vollure XC", country: "USA", desc: "ริ้วรอยปานกลาง ทนนาน", use: "ร่องแก้ม รอบปาก", price: "17,000-24,000", duration: "12-18 เดือน", popular: "รอง" },
  { id: "P016", category: "Filler", brand: "Juvederm Volux XC", country: "USA", desc: "ปรับรูปหน้า คาง แข็งสุด", use: "คาง ขากรรไกร", price: "22,000-32,000", duration: "18-24 เดือน", popular: "กระแส" },
  { id: "P017", category: "Filler", brand: "Restylane Lyft", country: "Sweden", desc: "ยกแก้ม มือ แข็ง", use: "แก้ม มือ", price: "19,000-28,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P018", category: "Filler", brand: "Restylane Defyne", country: "Sweden", desc: "ริ้วรอยลึก เคลื่อนไหวได้", use: "ร่องแก้ม รอบปาก", price: "18,000-26,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P019", category: "Filler", brand: "Restylane Refyne", country: "Sweden", desc: "ริ้วรอยกลาง ยืดหยุ่น", use: "ร่องแก้ม", price: "17,000-24,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P020", category: "Filler", brand: "Restylane Kysse", country: "Sweden", desc: "ปาก นุ่ม", use: "ปาก", price: "16,000-23,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P021", category: "Filler", brand: "Restylane Fynesse", country: "Sweden", desc: "ริ้วรอยตื้น ผิวบาง", use: "รอบปาก ริ้วรอยตื้น", price: "15,000-21,000", duration: "9-12 เดือน", popular: "รอง" },
  { id: "P022", category: "Filler", brand: "Restylane Volyme", country: "Sweden", desc: "ยกแก้ม รุ่นเก่า", use: "แก้ม", price: "18,000-26,000", duration: "12-18 เดือน", popular: "รอง" },
  { id: "P023", category: "Filler", brand: "Restylane Eyelight", country: "Sweden", desc: "ใต้ตา เฉพาะทาง", use: "ใต้ตา", price: "17,000-25,000", duration: "9-12 เดือน", popular: "กระแส" },
  { id: "P024", category: "Filler", brand: "Restylane Contour", country: "Sweden", desc: "ปรับรูปหน้า คาง", use: "คาง โหนกแก้ม", price: "20,000-29,000", duration: "12-18 เดือน", popular: "กระแส" },
  { id: "P025", category: "Filler", brand: "Belotero Volume", country: "Switzerland", desc: "ยกแก้ม คาง", use: "แก้ม คาง", price: "19,000-27,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P026", category: "Filler", brand: "Belotero Intense", country: "Switzerland", desc: "ริ้วรอยกลาง-ลึก", use: "ร่องแก้ม รอบปาก", price: "17,000-24,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P027", category: "Filler", brand: "Belotero Soft", country: "Switzerland", desc: "ริ้วรอยตื้น ผิวบาง", use: "ริ้วรอยตื้น", price: "15,000-21,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P028", category: "Filler", brand: "Belotero Balance", country: "Switzerland", desc: "ริ้วรอยปานกลาง", use: "ร่องแก้ม", price: "16,000-22,000", duration: "9-12 เดือน", popular: "รอง" },
  { id: "P029", category: "Filler", brand: "Belotero Lips Contour", country: "Switzerland", desc: "ปาก เฉพาะทาง", use: "ปาก", price: "16,000-23,000", duration: "9-12 เดือน", popular: "กระแส" },
  { id: "P030", category: "Filler", brand: "Belotero Revive", country: "Switzerland", desc: "Skin booster ผิวชุ่มชื้น", use: "ทั้งหน้า", price: "12,000-18,000", duration: "6-9 เดือน", popular: "กระแส" },
  { id: "P031", category: "Filler", brand: "Neuramis Volume", country: "Korea", desc: "ยกแก้ม แข็ง", use: "แก้ม คาง", price: "14,000-20,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P032", category: "Filler", brand: "Neuramis Deep", country: "Korea", desc: "ริ้วรอยลึก", use: "ร่องแก้ม รอบปาก", price: "12,000-18,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P033", category: "Filler", brand: "Neuramis Light", country: "Korea", desc: "ริ้วรอยตื้น", use: "ริ้วรอยตื้น ปาก", price: "10,000-15,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P034", category: "Filler", brand: "e.p.t.q. S500", country: "Korea", desc: "ยกแก้ม Hyal-Uronae HA", use: "แก้ม คาง", price: "15,000-22,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P035", category: "Filler", brand: "e.p.t.q. S300", country: "Korea", desc: "ริ้วรอยลึก", use: "ร่องแก้ม", price: "13,000-19,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P036", category: "Filler", brand: "e.p.t.q. S100", country: "Korea", desc: "ริ้วรอยตื้น", use: "ริ้วรอยตื้น", price: "11,000-16,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P037", category: "Filler", brand: "Yvoire Volume Plus", country: "Korea", desc: "ยกแก้ม คาง", use: "แก้ม คาง", price: "14,000-21,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P038", category: "Filler", brand: "Yvoire Classic Plus", country: "Korea", desc: "ริ้วรอยกลาง", use: "ร่องแก้ม", price: "12,000-17,000", duration: "9-12 เดือน", popular: "รอง" },
  { id: "P039", category: "Filler", brand: "Yvoire Contour", country: "Korea", desc: "ปรับรูปหน้า", use: "คาง ขากรรไกร", price: "15,000-22,000", duration: "12-18 เดือน", popular: "รอง" },
  { id: "P040", category: "Filler", brand: "Revolax Sub-Q", country: "Korea", desc: "ยกแก้ม ราคาย่อมเยา", use: "แก้ม คาง", price: "10,000-15,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P041", category: "Filler", brand: "Revolax Deep", country: "Korea", desc: "ริ้วรอยลึก", use: "ร่องแก้ม", price: "9,000-13,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P042", category: "Filler", brand: "Revolax Fine", country: "Korea", desc: "ริ้วรอยตื้น", use: "ริ้วรอยตื้น", price: "8,000-12,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P144", category: "Filler", brand: "Hyabell Volume", country: "Korea", desc: "ยกแก้ม", use: "แก้ม คาง", price: "12,000-18,000", duration: "9-12 เดือน", popular: "รอง" },
  { id: "P145", category: "Filler", brand: "Hyabell Basic", country: "Korea", desc: "ทั่วไป", use: "ร่องแก้ม ปาก", price: "10,000-15,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P146", category: "Filler", brand: "Princess Volume", country: "Austria", desc: "ยกแก้ม", use: "แก้ม", price: "13,000-19,000", duration: "9-12 เดือน", popular: "รอง" },
  { id: "P147", category: "Filler", brand: "Princess Filler", country: "Austria", desc: "ริ้วรอยกลาง", use: "ร่องแก้ม", price: "11,000-16,000", duration: "6-9 เดือน", popular: "รอง" },
  // === Biostimulator (P043–P052) ===
  { id: "P043", category: "Biostimulator", brand: "Sculptra", country: "USA", desc: "PLLA ยกแก้ม ยาวนาน", use: "แก้ม ขมับ", price: "35,000-50,000", duration: "24+ เดือน", popular: "TOP" },
  { id: "P044", category: "Biostimulator", brand: "Radiesse", country: "USA", desc: "CaHA ยกคาง มือ", use: "คาง มือ", price: "25,000-40,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P045", category: "Biostimulator", brand: "Radiesse Plus", country: "USA", desc: "CaHA + Lidocaine", use: "คาง มือ", price: "27,000-42,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P046", category: "Biostimulator", brand: "Juvelook", country: "Korea", desc: "PDLLA ผิวเงา เต่งตึง", use: "ทั้งหน้า คอ", price: "25,000-38,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P047", category: "Biostimulator", brand: "Lenisna", country: "Korea", desc: "PLLA+HA hybrid เห็นผลเร็ว", use: "ทั้งหน้า", price: "28,000-42,000", duration: "12-18 เดือน", popular: "กระแส" },
  { id: "P048", category: "Biostimulator", brand: "Gouri", country: "Korea", desc: "PCL Liquid กระจายทั่วหน้า", use: "ทั้งหน้า คอ", price: "30,000-45,000", duration: "12-18 เดือน", popular: "กระแส" },
  { id: "P049", category: "Biostimulator", brand: "AestheFill", country: "Korea", desc: "PDLLA คู่แข่ง Sculptra", use: "แก้ม ขมับ", price: "28,000-40,000", duration: "18-24 เดือน", popular: "รอง" },
  { id: "P050", category: "Biostimulator", brand: "Ellansé S", country: "Netherlands", desc: "PCL+CMC 1 year", use: "แก้ม คาง", price: "32,000-48,000", duration: "12 เดือน", popular: "กระแส" },
  { id: "P051", category: "Biostimulator", brand: "Ellansé M", country: "Netherlands", desc: "PCL+CMC 2 years", use: "แก้ม คาง", price: "38,000-55,000", duration: "24 เดือน", popular: "กระแส" },
  { id: "P052", category: "Biostimulator", brand: "Profhilo", country: "Italy", desc: "NAHYCO Hybrid HA", use: "ทั้งหน้า คอ", price: "18,000-28,000", duration: "6-9 เดือน", popular: "กระแส" },
  { id: "P148", category: "Biostimulator", brand: "Ellansé L", country: "Netherlands", desc: "PCL+CMC 3 years", use: "แก้ม คาง", price: "42,000-60,000", duration: "36 เดือน", popular: "กระแส" },
  { id: "P149", category: "Biostimulator", brand: "Ellansé E", country: "Netherlands", desc: "PCL+CMC 4 years", use: "แก้ม คาง", price: "48,000-68,000", duration: "48 เดือน", popular: "กระแส" },
  // === Skin Booster (P053–P069) ===
  { id: "P053", category: "Skin Booster", brand: "Rejuran Healer", country: "Korea", desc: "PDRN 2% ซ่อมแซมผิว", use: "ทั้งหน้า", price: "15,000-22,000", duration: "6-9 เดือน", popular: "TOP" },
  { id: "P054", category: "Skin Booster", brand: "Rejuran HB", country: "Korea", desc: "PDRN สูง ซ่อมแซมลึก", use: "ทั้งหน้า", price: "18,000-26,000", duration: "6-9 เดือน", popular: "TOP" },
  { id: "P055", category: "Skin Booster", brand: "Rejuran I", country: "Korea", desc: "สำหรับใต้ตา", use: "ใต้ตา", price: "12,000-18,000", duration: "6-9 เดือน", popular: "TOP" },
  { id: "P056", category: "Skin Booster", brand: "Rejuran S", country: "Korea", desc: "หลุมสิว รอยแผลเป็น", use: "หลุมสิว แผลเป็น", price: "15,000-23,000", duration: "6-9 เดือน", popular: "TOP" },
  { id: "P057", category: "Skin Booster", brand: "Rejuran Tone-up", country: "Korea", desc: "ผิวกระจ่างใส", use: "ทั้งหน้า", price: "16,000-24,000", duration: "6-9 เดือน", popular: "กระแส" },
  { id: "P058", category: "Skin Booster", brand: "Plinest Fast", country: "Italy", desc: "PDRN 2% ฟื้นฟูผิว", use: "ทั้งหน้า", price: "14,000-20,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P059", category: "Skin Booster", brand: "Plinest Care", country: "Italy", desc: "PDRN 1.5% บำรุงผิว", use: "ทั้งหน้า", price: "12,000-18,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P065", category: "Skin Booster", brand: "Chanel Sublimage", country: "France", desc: "HA+vanilla planifolia Luxury", use: "ทั้งหน้า", price: "80,000-120,000", duration: "3-6 เดือน", popular: "TOP" },
  { id: "P066", category: "Skin Booster", brand: "NCTF 135 HA", country: "France", desc: "55 ingredients Poly-revital", use: "ทั้งหน้า คอ", price: "12,000-18,000", duration: "6-9 เดือน", popular: "TOP" },
  { id: "P067", category: "Skin Booster", brand: "Teosyal Redensity I", country: "Switzerland", desc: "HA+amino+vitamins", use: "ทั้งหน้า", price: "13,000-19,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P068", category: "Skin Booster", brand: "Restylane Vital", country: "Sweden", desc: "HA ผิวแห้ง", use: "ทั้งหน้า มือ", price: "12,000-17,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P069", category: "Skin Booster", brand: "Juvederm Volite", country: "USA", desc: "HA นุ่ม ผิวชุ่มชื้น", use: "ทั้งหน้า", price: "13,000-19,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P156", category: "Skin Booster", brand: "Restylane Vital Light", country: "Sweden", desc: "HA ผิวบาง", use: "ทั้งหน้า คอ", price: "11,000-16,000", duration: "6-9 เดือน", popular: "รอง" },
  // === Exosome (P060–P064) ===
  { id: "P060", category: "Exosome", brand: "ASCE Plus", country: "Korea", desc: "10B exosomes ฟื้นฟู", use: "ทั้งหน้า คอ", price: "25,000-40,000", duration: "3-6 เดือน", popular: "TOP" },
  { id: "P061", category: "Exosome", brand: "EXOSOME PDRN", country: "Korea", desc: "PDRN+Exosome", use: "ทั้งหน้า", price: "28,000-42,000", duration: "3-6 เดือน", popular: "TOP" },
  { id: "P062", category: "Exosome", brand: "Exocobio ASCE", country: "Korea", desc: "ASCE แท้จากบริษัท", use: "ทั้งหน้า คอ", price: "26,000-41,000", duration: "3-6 เดือน", popular: "TOP" },
  { id: "P063", category: "Exosome", brand: "BENEV Exosome", country: "USA", desc: "15B particles Made in USA", use: "ทั้งหน้า", price: "35,000-50,000", duration: "3-6 เดือน", popular: "กระแส" },
  { id: "P064", category: "Exosome", brand: "Plexr Exosome", country: "Korea", desc: "Stem cell derived", use: "ทั้งหน้า", price: "24,000-38,000", duration: "3-6 เดือน", popular: "กระแส" },
  // === Vitamins / IV Drip (P070–P073, P161–P164) ===
  { id: "P070", category: "Vitamins", brand: "Cindella", country: "Korea", desc: "Glutathione+Vit C+ALA", use: "IV drip", price: "2,500-4,000", duration: "ต่อเนื่อง", popular: "TOP" },
  { id: "P071", category: "Vitamins", brand: "Snow White", country: "Korea", desc: "Glutathione complex", use: "IV drip", price: "2,800-4,500", duration: "ต่อเนื่อง", popular: "TOP" },
  { id: "P072", category: "Vitamins", brand: "Laennec", country: "Japan", desc: "Placenta extract", use: "ฉีด/IV", price: "3,500-6,000", duration: "ต่อเนื่อง", popular: "รอง" },
  { id: "P073", category: "Vitamins", brand: "Melsmon", country: "Japan", desc: "Placenta extract", use: "ฉีด", price: "3,200-5,500", duration: "ต่อเนื่อง", popular: "รอง" },
  { id: "P161", category: "Vitamins", brand: "Vitamin C Mega Dose", country: "Thailand", desc: "High-dose Vit C IV", use: "IV drip", price: "1,500-3,000", duration: "ต่อเนื่อง", popular: "TOP" },
  { id: "P162", category: "Vitamins", brand: "NAD Plus", country: "Thailand", desc: "NAD+ anti-aging", use: "IV drip", price: "8,000-15,000", duration: "ต่อเนื่อง", popular: "กระแส" },
  { id: "P163", category: "Vitamins", brand: "Liver Detox", country: "Thailand", desc: "Detox complex", use: "IV drip", price: "2,000-4,000", duration: "ต่อเนื่อง", popular: "TOP" },
  { id: "P164", category: "Vitamins", brand: "Collagen Booster", country: "Thailand", desc: "Collagen+Vit complex", use: "IV drip", price: "2,500-4,500", duration: "ต่อเนื่อง", popular: "TOP" },
  // === Fat Dissolving (P074–P078) ===
  { id: "P074", category: "Fat Dissolving", brand: "Kybella", country: "USA", desc: "Deoxycholic Acid FDA", use: "คาง double chin", price: "15,000-25,000", duration: "ถาวร", popular: "TOP" },
  { id: "P075", category: "Fat Dissolving", brand: "Aqualyx", country: "Italy", desc: "Deoxycholic Acid", use: "คาง แขน ขา", price: "12,000-20,000", duration: "ถาวร", popular: "TOP" },
  { id: "P076", category: "Fat Dissolving", brand: "Lemon Bottle", country: "Korea", desc: "Multi-ingredient เร็ว", use: "คาง แขน ขา ท้อง", price: "10,000-18,000", duration: "ถาวร", popular: "กระแส" },
  { id: "P077", category: "Fat Dissolving", brand: "Fat-X", country: "Korea", desc: "คู่แข่ง Lemon Bottle", use: "คาง แขน ท้อง", price: "9,000-16,000", duration: "ถาวร", popular: "กระแส" },
  { id: "P078", category: "Fat Dissolving", brand: "Cellulaze", country: "Korea", desc: "Phosphatidylcholine", use: "คาง แขน ขา", price: "8,000-14,000", duration: "ถาวร", popular: "รอง" },
  // === HIFU (P079–P085, P152) ===
  { id: "P079", category: "HIFU", brand: "Ultherapy", country: "USA", desc: "Gold standard FDA SMAS", use: "ทั้งหน้า คอ", price: "60,000-100,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P080", category: "HIFU", brand: "Ultraformer III", country: "Korea", desc: "MMFU multi-depth", use: "ทั้งหน้า คอ", price: "25,000-45,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P081", category: "HIFU", brand: "Ultraformer MPT", country: "Korea", desc: "Micro+Macro focused", use: "ทั้งหน้า คอ", price: "30,000-50,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P082", category: "HIFU", brand: "Doublo Gold", country: "Korea", desc: "HIFU multi-line", use: "ทั้งหน้า คอ", price: "20,000-35,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P083", category: "HIFU", brand: "LinearZ", country: "Korea", desc: "HIFU budget-friendly", use: "ทั้งหน้า", price: "18,000-30,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P084", category: "HIFU", brand: "Shurink", country: "Korea", desc: "HIFU ราคาย่อมเยา", use: "ทั้งหน้า", price: "15,000-25,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P085", category: "HIFU", brand: "Liftera", country: "Korea", desc: "HIFU ใหม่", use: "ทั้งหน้า", price: "16,000-28,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P152", category: "HIFU", brand: "Sofwave", country: "USA", desc: "Superb Synchronous Ultrasound", use: "ทั้งหน้า คอ", price: "35,000-55,000", duration: "9-12 เดือน", popular: "กระแส" },
  // === RF (P086, P094–P095, P150–P151) ===
  { id: "P086", category: "RF", brand: "Thermage FLX", country: "USA", desc: "RF monopolar ทั้งหน้า", use: "ทั้งหน้า คอ ตา", price: "70,000-120,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P094", category: "RF", brand: "Volnewmer", country: "Korea", desc: "Volumetric heating RF", use: "ทั้งหน้า คอ", price: "25,000-40,000", duration: "9-12 เดือน", popular: "กระแส" },
  { id: "P095", category: "RF", brand: "Exilis Ultra 360", country: "USA", desc: "RF+Ultrasound", use: "ทั้งหน้า ตัว", price: "20,000-35,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P150", category: "RF", brand: "Venus Legacy", country: "Canada", desc: "RF multipolar+Pulsed EM", use: "ทั้งหน้า ตัว", price: "18,000-32,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P151", category: "RF", brand: "Endymed Intensif", country: "Israel", desc: "RF Microneedling", use: "ทั้งหน้า", price: "20,000-35,000", duration: "9-12 เดือน", popular: "รอง" },
  // === RF Microneedling (P087–P093) ===
  { id: "P087", category: "RF Microneedling", brand: "Morpheus8", country: "USA", desc: "RF Fractional ลึก 8mm", use: "ทั้งหน้า คอ ตัว", price: "35,000-60,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P088", category: "RF Microneedling", brand: "Potenza", country: "USA", desc: "RF 4 modes", use: "ทั้งหน้า คอ", price: "30,000-50,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P089", category: "RF Microneedling", brand: "Genius", country: "USA", desc: "RF intelligent feedback", use: "ทั้งหน้า", price: "28,000-45,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P090", category: "RF Microneedling", brand: "Secret RF", country: "Korea", desc: "RF fractional", use: "ทั้งหน้า", price: "20,000-35,000", duration: "9-12 เดือน", popular: "รอง" },
  { id: "P091", category: "RF Microneedling", brand: "INFINI", country: "Korea", desc: "RF รุ่นเก่า", use: "ทั้งหน้า", price: "18,000-30,000", duration: "9-12 เดือน", popular: "รอง" },
  { id: "P092", category: "RF Microneedling", brand: "Sylfirm X", country: "Korea", desc: "Dual-wave RF", use: "ทั้งหน้า", price: "25,000-42,000", duration: "9-12 เดือน", popular: "กระแส" },
  { id: "P093", category: "RF Microneedling", brand: "Agnes RF", country: "Korea", desc: "RF เฉพาะทาง สิว", use: "สิว ถุงใต้ตา", price: "15,000-28,000", duration: "6-12 เดือน", popular: "กระแส" },
  // === Laser (P096–P117, P154–P155) ===
  { id: "P096", category: "Laser", brand: "PicoWay", country: "USA", desc: "1064/532/730nm รอยสัก ฝ้า", use: "ฝ้า รอยสัก กระ", price: "8,000-15,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P097", category: "Laser", brand: "PicoSure", country: "USA", desc: "755nm Alexandrite", use: "ฝ้า รอยสัก", price: "8,000-15,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P098", category: "Laser", brand: "Discovery Pico", country: "Italy", desc: "1064/532/694nm", use: "ฝ้า รอยสัก กระ", price: "7,000-13,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P099", category: "Laser", brand: "Pico Majesty", country: "Korea", desc: "1064/595/660nm", use: "ฝ้า กระ", price: "6,000-11,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P100", category: "Laser", brand: "Enlighten III", country: "USA", desc: "Dual 1064/532nm", use: "รอยสัก ฝ้า", price: "7,000-13,000", duration: "3-5 ครั้ง", popular: "รอง" },
  { id: "P101", category: "Laser", brand: "PicoPlus", country: "Korea", desc: "4 wavelengths", use: "ฝ้า รอยสัก", price: "6,000-11,000", duration: "3-5 ครั้ง", popular: "รอง" },
  { id: "P102", category: "Laser", brand: "V-Beam Perfecta", country: "USA", desc: "595nm PDL รอยแดง", use: "รอยแดง เส้นเลือดฝอย", price: "6,000-12,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P103", category: "Laser", brand: "Dual Yellow", country: "Korea", desc: "578nm KTP รอยแดง", use: "รอยแดง melasma", price: "5,000-10,000", duration: "5-8 ครั้ง", popular: "TOP" },
  { id: "P104", category: "Laser", brand: "Excel V Plus", country: "USA", desc: "532/1064nm vascular", use: "รอยแดง เส้นเลือด", price: "6,000-12,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P105", category: "Laser", brand: "GentleLase Pro", country: "USA", desc: "755nm Alexandrite", use: "ขนอ่อน ผิวขาว", price: "2,500-5,000", duration: "6-8 ครั้ง", popular: "TOP" },
  { id: "P106", category: "Laser", brand: "Gentle Max Pro", country: "USA", desc: "755+1064nm Combo", use: "ขนทุกสี ทุกผิว", price: "3,000-6,000", duration: "6-8 ครั้ง", popular: "TOP" },
  { id: "P107", category: "Laser", brand: "Soprano Ice Platinum", country: "Israel", desc: "755/810/1064 Diode SHR ไม่เจ็บ", use: "ขน ไม่เจ็บ", price: "2,800-5,500", duration: "6-8 ครั้ง", popular: "TOP" },
  { id: "P108", category: "Laser", brand: "Clarity II", country: "USA", desc: "755+1064nm Dual", use: "ขน รอยแดง", price: "3,000-6,000", duration: "6-8 ครั้ง", popular: "รอง" },
  { id: "P109", category: "Laser", brand: "LightSheer Quattro", country: "USA", desc: "Diode 800nm High-speed", use: "ขน รวดเร็ว", price: "2,500-5,000", duration: "6-8 ครั้ง", popular: "รอง" },
  { id: "P110", category: "Laser", brand: "UltraPulse Encore", country: "USA", desc: "CO2 Fractional resurfacing", use: "หลุมสิว แผลเป็น", price: "15,000-30,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P111", category: "Laser", brand: "Fraxel Dual", country: "USA", desc: "1550nm Fractional", use: "ผิวเรียบเนียน รูขุมขน", price: "12,000-25,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P112", category: "Laser", brand: "CO2RE", country: "USA", desc: "CO2 Fractional", use: "หลุมสิว", price: "13,000-26,000", duration: "3-5 ครั้ง", popular: "รอง" },
  { id: "P113", category: "Laser", brand: "eCO2", country: "Korea", desc: "CO2 Fractional", use: "หลุมสิว รูขุมขน", price: "10,000-20,000", duration: "3-5 ครั้ง", popular: "รอง" },
  { id: "P154", category: "Laser", brand: "Gentle YAG Pro-U", country: "USA", desc: "1064nm Nd:YAG ขนดำ", use: "ขนดำ ผิวคำ", price: "2,500-5,000", duration: "6-8 ครั้ง", popular: "รอง" },
  { id: "P155", category: "Laser", brand: "RevLite SI", country: "USA", desc: "Q-switched Nd:YAG", use: "ฝ้า รอยสัก", price: "6,000-11,000", duration: "5-8 ครั้ง", popular: "รอง" },
  // === IPL (P114–P117) ===
  { id: "P114", category: "IPL", brand: "M22", country: "USA", desc: "IPL+Nd:YAG multi", use: "กระ ขน รอยแดง", price: "5,000-10,000", duration: "5-8 ครั้ง", popular: "TOP" },
  { id: "P115", category: "IPL", brand: "BBL BroadBand Light", country: "USA", desc: "IPL Forever Young", use: "ผิวสว่าง anti-aging", price: "6,000-12,000", duration: "5-8 ครั้ง", popular: "TOP" },
  { id: "P116", category: "IPL", brand: "Nordlys", country: "UK", desc: "IPL Ellipse Frax", use: "กระ รอยแดง", price: "5,000-10,000", duration: "5-8 ครั้ง", popular: "รอง" },
  { id: "P117", category: "IPL", brand: "Stellar M22", country: "USA", desc: "รุ่นใหม่ M22", use: "กระ รอยแดง ขน", price: "5,500-11,000", duration: "5-8 ครั้ง", popular: "กระแส" },
  // === Acne (P118–P122, P168–P169) ===
  { id: "P118", category: "Acne", brand: "AviClear", country: "USA", desc: "Laser 1726nm FDA สิว", use: "สิวอักเสบ", price: "25,000-40,000", duration: "3-4 ครั้ง", popular: "กระแส" },
  { id: "P119", category: "Acne", brand: "Isolaz", country: "USA", desc: "Vacuum+Light สิว", use: "สิว รูขุมขน", price: "8,000-15,000", duration: "5-8 ครั้ง", popular: "รอง" },
  { id: "P120", category: "Acne", brand: "Gold PTT", country: "Korea", desc: "Gold nanoparticle สิว", use: "สิวอักเสบ", price: "10,000-18,000", duration: "3-5 ครั้ง", popular: "รอง" },
  { id: "P121", category: "Acne", brand: "Subcision", country: "Manual", desc: "ผ่าใต้ผิวหลุมสิว", use: "หลุมสิว", price: "5,000-10,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P122", category: "Acne", brand: "TCA CROSS", country: "Chemical", desc: "กรดเข้มข้นหลุมสิว", use: "หลุมสิว ice pick", price: "3,000-6,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P168", category: "Acne", brand: "Blue Light Therapy", country: "Thailand", desc: "LED 415nm สิว", use: "ทั้งหน้า", price: "1,500-3,000", duration: "8-12 ครั้ง", popular: "รอง" },
  { id: "P169", category: "Acne", brand: "Acne Extraction", country: "Thailand", desc: "กดสิว", use: "ทั้งหน้า", price: "800-1,500", duration: "ต่อเนื่อง", popular: "TOP" },
  // === Body (P123–P129, P153, P157, P172–P178) ===
  { id: "P123", category: "Body", brand: "CoolSculpting Elite", country: "USA", desc: "Cryolipolysis แช่แข็งไขมัน", use: "ท้อง แขน ขา", price: "30,000-60,000", duration: "ถาวร", popular: "TOP" },
  { id: "P124", category: "Body", brand: "Emsculpt Neo", country: "USA", desc: "RF+HIFEM กล้ามเนื้อ", use: "ท้อง ก้น แขน ขา", price: "35,000-70,000", duration: "6-12 เดือน", popular: "TOP" },
  { id: "P125", category: "Body", brand: "EmSculpt", country: "USA", desc: "HIFEM กล้ามเนื้อ", use: "ท้อง ก้น", price: "30,000-60,000", duration: "6-12 เดือน", popular: "TOP" },
  { id: "P126", category: "Body", brand: "Vanquish ME", country: "USA", desc: "RF contactless เผาไขมัน", use: "ท้อง", price: "25,000-45,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P127", category: "Body", brand: "truSculpt iD", country: "USA", desc: "Monopolar RF ลดไขมัน", use: "ท้อง แขน", price: "20,000-40,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P128", category: "Body", brand: "UltraShape", country: "Israel", desc: "Ultrasound ทำลายไขมัน", use: "ท้อง", price: "25,000-45,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P129", category: "Body", brand: "BodyTite", country: "USA", desc: "RF-assisted lipo กระชับ", use: "ท้อง แขน", price: "40,000-80,000", duration: "12-24 เดือน", popular: "กระแส" },
  { id: "P153", category: "Body", brand: "Emface", country: "USA", desc: "HIFEM Facial ยกหน้า", use: "ทั้งหน้า", price: "25,000-45,000", duration: "6-9 เดือน", popular: "กระแส" },
  { id: "P157", category: "Body", brand: "Forma", country: "USA", desc: "RF body tightening", use: "ตัว", price: "15,000-28,000", duration: "6-9 เดือน", popular: "รอง" },
  { id: "P172", category: "Body", brand: "Mesotherapy Fat", country: "Thailand", desc: "Fat dissolving cocktail", use: "แขน ท้อง ขา", price: "5,000-10,000", duration: "6-8 ครั้ง", popular: "TOP" },
  { id: "P173", category: "Body", brand: "Cavitation", country: "Thailand", desc: "Ultrasound fat reduction", use: "ท้อง แขน", price: "3,000-6,000", duration: "6-8 ครั้ง", popular: "รอง" },
  { id: "P174", category: "Body", brand: "Vacuum RF", country: "Thailand", desc: "Suction + RF", use: "ท้อง ขา", price: "2,500-5,000", duration: "8-12 ครั้ง", popular: "รอง" },
  { id: "P177", category: "Body", brand: "Slimming Wrap", country: "Thailand", desc: "Body wrap detox", use: "ตัว", price: "2,000-4,000", duration: "6-8 ครั้ง", popular: "รอง" },
  { id: "P178", category: "Body", brand: "Pressotherapy", country: "Thailand", desc: "Lymphatic drainage machine", use: "ขา", price: "2,000-4,000", duration: "8-10 ครั้ง", popular: "รอง" },
  // === Thread Lift (P130–P136) ===
  { id: "P130", category: "Thread", brand: "Silhouette Soft", country: "USA", desc: "Cones+Biodegradable", use: "หน้า คอ", price: "35,000-60,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P131", category: "Thread", brand: "Mint Lift", country: "Korea", desc: "PDO/PLLA cog", use: "หน้า คอ", price: "25,000-45,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P132", category: "Thread", brand: "APTOS", country: "Russia", desc: "PDO/PLLA", use: "หน้า คอ", price: "28,000-50,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P133", category: "Thread", brand: "V-Soft", country: "Korea", desc: "PDO Mono/Cog/Screw", use: "หน้า", price: "20,000-35,000", duration: "9-12 เดือน", popular: "TOP" },
  { id: "P134", category: "Thread", brand: "Hiko Nose", country: "Korea", desc: "PCL จมูก", use: "จมูก", price: "15,000-25,000", duration: "12-18 เดือน", popular: "TOP" },
  { id: "P135", category: "Thread", brand: "Miracu", country: "Korea", desc: "PDO thread", use: "หน้า", price: "18,000-30,000", duration: "9-12 เดือน", popular: "รอง" },
  { id: "P136", category: "Thread", brand: "N-Finders", country: "Korea", desc: "PDO thread", use: "หน้า", price: "17,000-28,000", duration: "9-12 เดือน", popular: "รอง" },
  // === Treatment (P137–P143, P158–P160, P165–P167, P170–P171, P175–P176, P179–P180) ===
  { id: "P137", category: "Treatment", brand: "HydraFacial MD", country: "USA", desc: "Vacuum+infusion", use: "ทั้งหน้า", price: "3,500-6,000", duration: "ทุกเดือน", popular: "TOP" },
  { id: "P138", category: "Treatment", brand: "Aqua Peel", country: "Korea", desc: "คู่แข่ง Hydrafacial", use: "ทั้งหน้า", price: "2,500-4,500", duration: "ทุกเดือน", popular: "TOP" },
  { id: "P139", category: "Treatment", brand: "Intraceuticals", country: "USA", desc: "Oxygen+serum", use: "ทั้งหน้า", price: "4,000-7,000", duration: "ทุกเดือน", popular: "รอง" },
  { id: "P140", category: "Treatment", brand: "Omnilux", country: "UK", desc: "LED light therapy", use: "ทั้งหน้า สิว", price: "2,000-4,000", duration: "2 ครั้ง/สัปดาห์", popular: "รอง" },
  { id: "P142", category: "Treatment", brand: "Jett Plasma Lift", country: "USA", desc: "Plasma fibroblast", use: "หนังตาตก ริ้วรอย", price: "15,000-30,000", duration: "6-12 เดือน", popular: "กระแส" },
  { id: "P143", category: "Treatment", brand: "CryoStar", country: "Italy", desc: "Whole body cryotherapy", use: "ทั้งตัว", price: "3,000-6,000", duration: "ต่อเนื่อง", popular: "กระแส" },
  { id: "P158", category: "Treatment", brand: "Chemical Peel Medium", country: "Thailand", desc: "TCA 20-30%", use: "ทั้งหน้า", price: "3,000-6,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P159", category: "Treatment", brand: "Chemical Peel Deep", country: "Thailand", desc: "TCA 40-50% Phenol", use: "ทั้งหน้า", price: "5,000-10,000", duration: "1-3 ครั้ง", popular: "รอง" },
  { id: "P160", category: "Treatment", brand: "Microneedling", country: "Manual", desc: "Derma roller pen", use: "ทั้งหน้า", price: "2,500-5,000", duration: "4-6 ครั้ง", popular: "TOP" },
  { id: "P165", category: "Treatment", brand: "Oxygen Facial", country: "Thailand", desc: "O2 + hydration", use: "ทั้งหน้า", price: "2,000-4,000", duration: "ต่อเนื่อง", popular: "รอง" },
  { id: "P166", category: "Treatment", brand: "Diamond Peel", country: "Thailand", desc: "Microdermabrasion", use: "ทั้งหน้า", price: "1,500-3,000", duration: "ต่อเนื่อง", popular: "TOP" },
  { id: "P167", category: "Treatment", brand: "Carbon Laser Peel", country: "Thailand", desc: "Carbon + Q-switch", use: "ทั้งหน้า", price: "3,000-6,000", duration: "4-6 ครั้ง", popular: "TOP" },
  { id: "P170", category: "Treatment", brand: "Mesotherapy Face", country: "Thailand", desc: "Vitamins + HA cocktail", use: "ทั้งหน้า", price: "3,000-6,000", duration: "4-6 ครั้ง", popular: "TOP" },
  { id: "P171", category: "Treatment", brand: "Mesotherapy Hair", country: "Thailand", desc: "Hair growth cocktail", use: "ศีรษะ", price: "4,000-8,000", duration: "6-10 ครั้ง", popular: "TOP" },
  { id: "P175", category: "Treatment", brand: "Facial Massage", country: "Thailand", desc: "Manual lymphatic", use: "ทั้งหน้า คอ", price: "1,500-3,000", duration: "ต่อเนื่อง", popular: "TOP" },
  { id: "P176", category: "Treatment", brand: "Gua Sha Facial", country: "Thailand", desc: "Traditional + modern", use: "ทั้งหน้า", price: "2,000-4,000", duration: "ต่อเนื่อง", popular: "กระแส" },
  { id: "P179", category: "Treatment", brand: "Vampire Facial", country: "Thailand", desc: "PRP + microneedling", use: "ทั้งหน้า", price: "8,000-15,000", duration: "3-5 ครั้ง", popular: "TOP" },
  { id: "P180", category: "Treatment", brand: "Hair PRP", country: "Thailand", desc: "PRP scalp injection", use: "ศีรษะ", price: "10,000-18,000", duration: "3-6 ครั้ง", popular: "TOP" },
] as const;

export type ProductItem = (typeof ALL_PRODUCTS)[number];

// ─────────────────────────────────────────
// P2 — Voice Personas (6 แบบ)
// ─────────────────────────────────────────
export const VOICE_PERSONAS = {
  V01: {
    name: "Medical Expert",
    tone: "professional",
    formality: "high",
    pronouns_customer: ["คุณ", "ท่าน"],
    pronouns_self: ["หมอ", "คุณหมอ", "ทีมแพทย์"],
    keywords: ["ตามหลักสรีรศาสตร์", "กลไกการออกฤทธิ์", "FDA approved", "หลักฐานทางคลินิก"],
    forbidden: ["ใช้สแลง", "โอ้อวด", "เรียกแบบเป็นกันเอง", "กดดันตัดสินใจ"],
    emoji_max: 1,
    opening: "สวัสดีครับ ผมเป็นทีมแพทย์ ยินดีให้คำปรึกษาครับ",
  },
  V02: {
    name: "Ultra Luxury",
    tone: "elegant",
    formality: "very_high",
    pronouns_customer: ["คุณผู้หญิง", "คุณผู้ชาย", "ท่าน"],
    pronouns_self: ["เรา", "ทีม", "คลีนิก"],
    keywords: ["เอกสิทธิ์", "ประสบการณ์เหนือระดับ", "การลงทุนกับตัวเอง", "คุณค่าระยะยาว", "Bespoke treatment"],
    forbidden: ["พูดถึงราคาตรง", "คำว่าถูก ลด โปร", "ตอบสั้นเกินไป"],
    emoji_max: 2,
    opening: "สวัสดีค่ะ ยินดีต้อนรับสู่ประสบการณ์เหนือระดับ ✨",
  },
  V03: {
    name: "Friendly Sister",
    tone: "warm",
    formality: "medium",
    pronouns_customer: ["น้อง", "ลูก", "ที่รัก"],
    pronouns_self: ["พี่", "เรา"],
    keywords: ["ตัวนี้พี่ลองแล้วดีจริง", "ไม่ต้องกังวลนะลูก", "พี่ดูแลให้เอง", "สวยสับแน่นอน"],
    forbidden: ["คำหยาบ", "บีบให้ซื้อ", "เปรียบเทียบดูถูก"],
    emoji_max: 3,
    opening: "สวัสดีจ้า น้อง! 😊 พี่ยินดีให้คำปรึกษานะคะ",
  },
  V04: {
    name: "Trendy Witty",
    tone: "fun",
    formality: "low",
    pronouns_customer: ["ยู", "เธอ", "จ้า"],
    pronouns_self: ["เรา", "พี่"],
    keywords: ["ปัง", "จึ้ง", "สับ", "ฉ่ำวาว", "โคตรปัง", "งานผิวลูกรักพระเจ้า"],
    forbidden: ["สแลงเก่า ล้าสมัย", "คำหยาบ", "ข้อมูลเกินจริง", "ตลกจนไม่น่าเชื่อถือ"],
    emoji_max: 4,
    opening: "Hi! 🎉 ยินดีต้อนรับจ้า มีอะไรให้ช่วยไหมคะ",
  },
  V05: {
    name: "Minimalist",
    tone: "clean",
    formality: "medium",
    pronouns_customer: ["คุณ"],
    pronouns_self: ["เรา", "ทีม"],
    keywords: ["สรุปผลลัพธ์", "ราคา Net", "จองเลย", "Quick result", "Express treatment"],
    forbidden: ["ขยายความยาว", "คุยเล็กคุยน้อย", "ใช้ภาษาดอกไม้"],
    emoji_max: 1,
    opening: "สวัสดีครับ มีอะไรให้ช่วยไหมครับ",
  },
  V06: {
    name: "Sincere Care",
    tone: "honest",
    formality: "medium",
    pronouns_customer: ["คุณ"],
    pronouns_self: ["ผม", "ดิฉัน", "หมอ", "ทีม"],
    keywords: ["หมอแนะนำตามจริง", "ไม่เน้นขายแต่เน้นแก้ปัญหา", "บอกตรงๆ", "ความสบายใจระยะยาว"],
    forbidden: ["โกหก", "ให้หวังเกินจริง", "บิดเบือนข้อมูล", "กดดันให้ตัดสินใจเร็ว", "ปกปิดผลข้างเคียง"],
    emoji_max: 2,
    opening: "สวัสดีค่ะ ยินดีให้คำปรึกษาค่ะ 😊",
  },
} as const;

// ─────────────────────────────────────────
// P3 — Customer Segments (10 กลุ่ม)
// ─────────────────────────────────────────
export const CUSTOMER_SEGMENTS = {
  C01: {
    name: "Gen Z Trendseeker",
    age: "18-25",
    budget: "2,000-5,000",
    pain_points: ["กลัวแพง งบน้อย", "กลัวพลาด ไม่มีประสบการณ์", "กลัวโดนหลอก กลัวของปลอม", "กลัวพ่อแม่รู้", "กลัวเจ็บ"],
    triggers: ["โปรนักศึกษาลดพิเศษ 20%", "ของแท้ 100% มี QR code", "ไม่เจ็บ มียาชา", "เห็นผลไวใน 3-7 วัน", "TikTok viral", "ผ่อน 0%"],
  },
  C02: {
    name: "Gen Y Perfectionist",
    age: "26-40",
    budget: "10,000-50,000",
    pain_points: ["กลัวดูแก่ เพื่อนยังสาว", "กลัวไม่คุ้ม ทำแล้วไม่เห็นผล", "ไม่มีเวลา งานยุ่ง", "กลัวหน้าแข็ง", "กลัวคนรู้"],
    triggers: ["ดูอ่อนกว่าวัยจริง 5-10 ปี", "Natural ไม่มีใครรู้", "ไม่มี downtime ทำงานได้เลย", "คุ้มค่าระยะยาว อยู่ได้ 1-2 ปี", "FDA approved"],
  },
  C03: {
    name: "Gen X Ageless",
    age: "41+",
    budget: "50,000-200,000",
    pain_points: ["กลัวดูแก่เกินวัย", "ผิวหย่อนคล้อย แก้มตก", "ฝ้าหนา ริ้วรอยลึก", "กลัวดูเทียม หน้าตึง"],
    triggers: ["ย้อนวัย 10-15 ปี แต่ธรรมชาติ", "ยกกระชับระดับ SMAS ลึกสุด", "FDA approved มาตรฐานสากล", "ไม่ต้องผ่าตัด ไม่มีแผล", "ผลคงทนนาน 1-2 ปี"],
  },
  C04: {
    name: "Bride to be",
    age: "25-35",
    budget: "30,000-100,000",
    pain_points: ["กดดันเวลา เหลือไม่มาก", "กลัวผลไม่ทันออก", "กลัวบวม ช้ำ downtime", "กลัวหน้าแข็งเทียม ถ่ายรูปไม่สวย"],
    triggers: ["แพ็คเกจ Bridal พิเศษ", "Timeline ชัดเจน ผลออกทันแน่นอน", "ผิวออร่า กระจ่างใส ในวันสำคัญ", "ถ่ายรูปสวยทุกองศา", "ผ่อน 0% พิเศษเจ้าสาว"],
  },
  C05: {
    name: "The Fixer",
    age: "25-45",
    budget: "10,000-50,000",
    pain_points: ["บาดใจมาก เคยโดนหลอก", "กลัวเสียเงินเพิ่ม ทำหลายที่แล้ว", "กลัวแก้ไม่ได้", "ขี้ระแวง ถามเยอะ ไม่เชื่อ"],
    triggers: ["เชี่ยวชาญแก้เคสยาก ประสบการณ์หลายพันเคส", "Hyalase ของแท้ ละลาย Filler ปลอดภัย", "ให้คำปรึกษาฟรีก่อน", "มีภาพก่อน-หลัง แก้เคสจริง"],
  },
  C06: {
    name: "Naturalist",
    age: "30-50",
    budget: "5,000-80,000",
    pain_points: ["กลัวเข็ม", "กลัวหน้าแข็ง เห็นคนอื่นทำตึง", "กลัวผลข้างเคียง กลัวแพ้", "กลัวดูเทียม"],
    triggers: ["ไม่ใช้เข็ม ไม่มีแผล", "ธรรมชาติ 100% ไม่มีใครรู้ว่าทำ", "กระตุ้นคอลลาเจนตัวเอง", "ผลค่อยเป็นค่อยไป ไม่ช็อก", "Skin Booster บำรุงผิวจากภายใน"],
  },
  C07: {
    name: "Budget Hunter",
    age: "20-40",
    budget: "3,000-15,000",
    pain_points: ["กลัวแพง รายได้ไม่สูง", "กลัวไม่คุ้ม จ่ายไปไม่เห็นผล", "เปรียบเทียบ หลายที่ถูกกว่า", "FOMO กลัวพลาดโปร"],
    triggers: ["โปรพิเศษเดือนนี้ เท่านั้น", "ลดสูงสุด 30-50%", "ซื้อ 1 แถม 1", "Bundle Package คุ้มสุด", "Flash Sale วันนี้-พรุ่งนี้", "ผ่อน 0% ไม่มีดอกเบี้ย"],
  },
  C08: {
    name: "Male Aesthetic",
    age: "25-50",
    budget: "10,000-100,000",
    pain_points: ["อายเข้าคลีนิก กลัวถูกมอง", "กลัวดูหวานเกิน ต้องการดูแมน", "รูขุมขนกว้าง สิวเสี้ยน", "ไม่มีเวลา"],
    triggers: ["ดูดี มีออร่า แต่ยังแมน", "ไม่หวาน ดูเป็นธรรมชาติ", "ห้องส่วนตัว ไม่ต้องกังวล", "รวดเร็ว ไม่เสียเวลา", "ผู้บริหาร ดารา ทำกันเยอะ"],
  },
  C09: {
    name: "Influencer Creator",
    age: "20-35",
    budget: "5,000-30,000",
    pain_points: ["ต้องสวยหน้ากล้องตลอด", "Downtime ต้องน้อย", "ต้องเห็นผลไว", "งบจำกัด แต่ต้องดูดี"],
    triggers: ["เห็นผลทันที ถ่ายรูปปังเลย", "ไม่มี downtime ถ่ายคอนเทนต์ได้เลย", "Influencer Package พิเศษ", "รีวิวแลกส่วนลด", "ถ่าย Before-After สวยๆ ให้"],
  },
  C10: {
    name: "Mua โหงวเฮ้ง",
    age: "30-55",
    budget: "15,000-60,000",
    pain_points: ["ดวงไม่ดี เจ๊ง ขาดทุน", "หน้าไม่ดีตามหลักโหงวเฮ้ง", "อยากเปลี่ยนชีวิต ทำธุรกิจ อยากรวย"],
    triggers: ["ปรับรูปหน้าตามหลักมูเตลู", "เรียกทรัพย์ เสริมดวง", "คางยาว = อายุยืน มั่งคั่ง", "ปากอิ่ม = โชคลาภ", "จมูกสูง = การเงินดี"],
  },
} as const;

// ─────────────────────────────────────────
// P4 — Intents (20 สถานการณ์)
// ─────────────────────────────────────────
export const INTENTS = [
  { id: "I01", category: "Discovery & Pricing", name: "Direct Price Check", desc: "ถามราคาตรงๆ เช่น 1cc เท่าไหร่ มีโปรไหม", guidance: "ตอบราคาชัดเจน + อธิบายสิ่งที่ได้รับ + แนะนำโปรโมชั่น" },
  { id: "I02", category: "Discovery & Pricing", name: "Compare Tiers", desc: "เปรียบเทียบรุ่น/ยี่ห้อ", guidance: "อธิบายความแตกต่างอย่างเป็นกลาง แนะนำที่เหมาะสมกับลูกค้า" },
  { id: "I03", category: "Discovery & Pricing", name: "Bundle Seeking", desc: "หาแพ็คเกจเหมาทำหลายอย่างพร้อมกัน", guidance: "แนะนำ package ที่คุ้มค่า อธิบายประโยชน์รวม" },
  { id: "I04", category: "Discovery & Pricing", name: "Budget Constraint", desc: "บอกงบที่มี แล้วให้จัดโปรแกรมให้", guidance: "จัดโปรแกรมตามงบ เน้นคุ้มค่าสุด" },
  { id: "I05", category: "Objection Handling", name: "Fear of Pain", desc: "กลัวเจ็บ", guidance: "Reassure + อธิบายยาชา + แบ่งปันประสบการณ์จริง" },
  { id: "I06", category: "Objection Handling", name: "Safety Authentication", desc: "ขอดูของแท้ QR code สแกน อย.", guidance: "ยืนยันของแท้ + อธิบาย QR code + พร้อมแกะให้ดูต่อหน้า" },
  { id: "I07", category: "Objection Handling", name: "Downtime Concern", desc: "กลัวบวม ช้ำ ไปทำงานไม่ได้", guidance: "อธิบาย downtime จริงๆ ไม่โอ้อวด + after-care tips" },
  { id: "I08", category: "Objection Handling", name: "Side Effects", desc: "กังวลผลข้างเคียง หน้าแข็ง ฟิลเลอร์ไหล", guidance: "ให้ข้อมูลถูกต้อง ไม่โอ้อวด แนะนำพบแพทย์" },
  { id: "I09", category: "Comparison & Hesitation", name: "Competitor Price Match", desc: "ที่อื่นถูกกว่า", guidance: "Value reframe ไม่ใส่ร้ายคู่แข่ง เน้นคุณภาพและความปลอดภัย" },
  { id: "I10", category: "Comparison & Hesitation", name: "Review Hunting", desc: "ขอดูรีวิวเคสที่เหมือนตัวเอง", guidance: "แนะนำรีวิวที่เหมาะสม + before-after จริง" },
  { id: "I11", category: "Comparison & Hesitation", name: "Expert Validation", desc: "ถามความเห็นหมอว่าต้องทำจริงไหม", guidance: "ให้ข้อมูลตามจริง แนะนำปรึกษาแพทย์โดยตรง" },
  { id: "I12", category: "Comparison & Hesitation", name: "Second Opinion", desc: "เคยทำที่อื่นแล้วไม่ถูกใจ มาปรึกษาใหม่", guidance: "รับฟังปัญหา ประเมิน แนะนำแนวทางแก้ไข" },
  { id: "I13", category: "Urgency & Closing", name: "Special Occasion", desc: "รีบสวย มีงาน แต่งงาน เที่ยว", guidance: "แนะนำที่ไม่มี downtime + timeline ชัดเจน" },
  { id: "I14", category: "Urgency & Closing", name: "Limited Time Offer", desc: "ทักมารับสิทธิ์นาทีทอง", guidance: "ยืนยันโปร + สร้าง urgency เบาๆ + เชิญจอง" },
  { id: "I15", category: "Urgency & Closing", name: "Deposit Booking", desc: "พร้อมโอนจอง มัดจำ หรือถามช่องทางชำระ", guidance: "อธิบายขั้นตอนจอง + ช่องทางชำระ + เตรียมตัว" },
  { id: "I16", category: "Urgency & Closing", name: "Moo-talu", desc: "ทำเพื่อเสริมดวง โหงวเฮ้ง", guidance: "ตอบตามหลักมูเตลู + แนะนำที่เหมาะสม" },
  { id: "I17", category: "Post-Purchase", name: "Aftercare Query", desc: "ถามวิธีดูแลหลังทำ", guidance: "After-care ละเอียด + สิ่งที่ห้ามทำ" },
  { id: "I18", category: "Post-Purchase", name: "Result Follow-up", desc: "สงสัยเรื่องผลลัพธ์ ทำไปแล้วยังไม่เห็นผล", guidance: "อธิบาย timeline จริงๆ + reassure" },
  { id: "I19", category: "Post-Purchase", name: "Referral Review", desc: "กลับมารีวิว พาเพื่อนมา", guidance: "ขอบคุณ + แนะนำ referral program + ส่วนลด" },
  { id: "I20", category: "Post-Purchase", name: "Complaint Handling", desc: "เคลมปัญหา ไม่เท่ากัน มีตุ่มขึ้น", guidance: "รับฟัง + ขอโทษ + แก้ไขทันที + นัดหมายแพทย์" },
] as const;

// ─────────────────────────────────────────
// Helper — detect segment จาก message
// ─────────────────────────────────────────
export function detectSegment(message: string): (typeof CUSTOMER_SEGMENTS)[keyof typeof CUSTOMER_SEGMENTS] {
  const m = message.toLowerCase();
  if (m.includes("แต่งงาน") || m.includes("เจ้าสาว") || m.includes("งานแต่ง")) return CUSTOMER_SEGMENTS.C04;
  if (m.includes("มูเตลู") || m.includes("โหงวเฮ้ง") || m.includes("เสริมดวง") || m.includes("เรียกทรัพย์")) return CUSTOMER_SEGMENTS.C10;
  if (m.includes("รีวิว") || m.includes("คอนเทนต์") || m.includes("influencer") || m.includes("tiktok")) return CUSTOMER_SEGMENTS.C09;
  if (m.includes("ผู้ชาย") || m.includes("แมน") || m.includes("สิวเสี้ยน")) return CUSTOMER_SEGMENTS.C08;
  if (m.includes("ถูก") || m.includes("โปร") || m.includes("ลด") || m.includes("งบน้อย") || m.includes("ผ่อน")) return CUSTOMER_SEGMENTS.C07;
  if (m.includes("แพ้") || m.includes("กลัวเข็ม") || m.includes("ธรรมชาติ") || m.includes("ไม่อยากให้รู้")) return CUSTOMER_SEGMENTS.C06;
  if (m.includes("แก้") || m.includes("ทำที่อื่นมาแล้ว") || m.includes("ไม่พอใจ")) return CUSTOMER_SEGMENTS.C05;
  if (m.includes("อายุ 4") || m.includes("อายุ 5") || m.includes("หย่อนคล้อย") || m.includes("ริ้วรอยลึก")) return CUSTOMER_SEGMENTS.C03;
  if (m.includes("งาน") || m.includes("ยุ่ง") || m.includes("ไม่มีเวลา") || m.includes("ดูแก่")) return CUSTOMER_SEGMENTS.C02;
  return CUSTOMER_SEGMENTS.C01; // default Gen Z
}

// ─────────────────────────────────────────
// Helper — detect intent จาก message
// ─────────────────────────────────────────
export function detectIntent(message: string): (typeof INTENTS)[number] {
  const m = message.toLowerCase();
  if (m.includes("จอง") || m.includes("มัดจำ") || m.includes("โอนเงิน") || m.includes("ชำระ")) return INTENTS[14]; // I15
  if (m.includes("แต่งงาน") || m.includes("เที่ยว") || m.includes("รีบ") || m.includes("ทันไหม")) return INTENTS[12]; // I13
  if (m.includes("โปร") || m.includes("ทันไหม") || m.includes("สิทธิ์")) return INTENTS[13]; // I14
  if (m.includes("มูเตลู") || m.includes("ดวง") || m.includes("โหงวเฮ้ง")) return INTENTS[15]; // I16
  if (m.includes("เจ็บ") || m.includes("เจ็บไหม") || m.includes("ปวด")) return INTENTS[4]; // I05
  if (m.includes("ของแท้") || m.includes("สแกน") || m.includes("qr") || m.includes("อย.")) return INTENTS[5]; // I06
  if (m.includes("บวม") || m.includes("ช้ำ") || m.includes("downtime") || m.includes("ทำงานได้ไหม")) return INTENTS[6]; // I07
  if (m.includes("ผลข้างเคียง") || m.includes("แข็ง") || m.includes("ฟิลเลอร์ไหล")) return INTENTS[7]; // I08
  if (m.includes("ที่อื่น") || m.includes("ถูกกว่า") || m.includes("คลีนิกอื่น")) return INTENTS[8]; // I09
  if (m.includes("รีวิว") || m.includes("before after") || m.includes("ตัวอย่าง")) return INTENTS[9]; // I10
  if (m.includes("แพ็คเกจ") || m.includes("เหมา") || m.includes("bundle") || m.includes("ทำหลาย")) return INTENTS[2]; // I03
  if (m.includes("งบ") || m.includes("มีแค่") || m.includes("ทำได้อะไรบ้าง")) return INTENTS[3]; // I04
  if (m.includes("ราคา") || m.includes("เท่าไหร่") || m.includes("1cc") || m.includes("กี่บาท")) return INTENTS[0]; // I01
  if (m.includes("ดูแล") || m.includes("หลังทำ") || m.includes("กินอะไร") || m.includes("ห้ามอะไร")) return INTENTS[16]; // I17
  if (m.includes("ไม่เห็นผล") || m.includes("ผลลัพธ์") || m.includes("กี่วัน")) return INTENTS[17]; // I18
  if (m.includes("เคลม") || m.includes("ปัญหา") || m.includes("ไม่เท่ากัน") || m.includes("ตุ่ม")) return INTENTS[19]; // I20
  return INTENTS[0]; // default Direct Price Check
}

/** จัดรูปแบบ P1-P4 เป็นข้อความสำหรับ inject เข้า System Prompt */
export function formatClinicKnowledgeForPrompt(options?: {
  maxChars?: number;
  categories?: string[];
}): string {
  const maxChars = options?.maxChars ?? 20000;
  const filterCategories = options?.categories;
  const items: ProductItem[] = filterCategories?.length
    ? [...ALL_PRODUCTS].filter((p) => filterCategories.includes(p.category))
    : [...ALL_PRODUCTS];
  const p1Lines = items.map((p) => {
    return `${p.id} ${p.brand} (${p.category}, ${p.country}): ${p.desc} | ใช้: ${p.use} | ราคา ${p.price}฿ | คงอยู่ ${p.duration}`;
  });
  const p2Lines = Object.entries(VOICE_PERSONAS).map(([id, v]) => {
    return `${id} ${v.name}: tone=${v.tone}, formality=${v.formality} | เรียกลูกค้า: ${v.pronouns_customer.join(", ")} | เรียกตัวเอง: ${v.pronouns_self.join(", ")} | คำที่ใช้: ${v.keywords.slice(0, 3).join(", ")} | ห้าม: ${v.forbidden.slice(0, 2).join(", ")} | emoji สูงสุด ${v.emoji_max}`;
  });
  const p3Lines = Object.entries(CUSTOMER_SEGMENTS).map(([id, c]) => {
    return `${id} ${c.name} (${c.age}, งบ ${c.budget}): ปัญหา ${c.pain_points.slice(0, 2).join("; ")} | จุดกระตุ้น ${c.triggers.slice(0, 3).join("; ")}`;
  });
  const p4Lines = INTENTS.map((i) => {
    return `${i.id} [${i.category}] ${i.name}: ${i.desc} | แนวทาง: ${i.guidance}`;
  });
  const raw = `## P1 — Products (คลินิกความงาม)\n${p1Lines.join("\n")}\n\n## P2 — Voice Personas (6 แบบ)\n${p2Lines.join("\n")}\n\n## P3 — Customer Segments (10 กลุ่ม)\n${p3Lines.join("\n")}\n\n## P4 — Intents (20 สถานการณ์)\n${p4Lines.join("\n")}`;
  if (raw.length <= maxChars) return raw;
  return raw.slice(0, maxChars - 50) + "\n...(truncated)";
}
