/**
 * Compose Templates — ครอบคลุม "ทุกคำถาม"
 * ทำให้บอท "ดูเหมือนแอดมินมืออาชีพทุกสาขา"
 */
import type { ConversationState } from "./conversation-state";
import { getServiceKnowledge, getServicesForArea } from "./knowledge-base";
import type { ServiceCategory, Area } from "./types";
import { hasFixedArea } from "./types";

/**
 * Template 1a: คำถามกว้างสำหรับหัตถการผิว (ฟิลเลอร์ / โบท็อกซ์ / รีจูรัน)
 * ใช้เมื่อ: stage = exploring, service ยังไม่ชัด, ไม่ใช่ศัลยกรรม
 * ✅ FIX 2: แยก Template Exploring เป็น 2 แบบ (ผิว / ศัลยกรรม)
 */
export function templateExploringSkin(state: ConversationState): string {
  return `ได้เลยค่ะ 😊  
ด้านนี้เรามีหลายตัวเลือก ขึ้นอยู่กับผลลัพธ์ที่อยากได้ เช่น  
• ฟิลเลอร์ → ปรับรูปหน้า เติมเต็ม  
• รีจูรัน → ฟื้นฟูผิว หน้าใส  
• โบท็อกซ์ → ลดริ้วรอย ปรับรูปหน้า  
• เลเซอร์ / ทรีตเมนต์ → ดูแลผิวโดยรวม  

อยากได้แนวไหนเป็นพิเศษคะ เดี๋ยวแนะนำให้ตรงที่สุดค่ะ 💕`;
}

/**
 * Template 1b: คำถามกว้างสำหรับศัลยกรรม (เสริมจมูก / ตาสองชั้น / คาง)
 * ใช้เมื่อ: stage = exploring, service ยังไม่ชัด, เป็นศัลยกรรม
 * ✅ FIX 2: แยก Template Exploring เป็น 2 แบบ (ผิว / ศัลยกรรม)
 */
export function templateExploringSurgery(state: ConversationState): string {
  return `ได้เลยค่ะ 😊  
แอดมินขอทราบเพิ่มนิดนึงนะคะ ว่าสนใจศัลยกรรมด้านไหนเป็นพิเศษ  

เช่น  
• เสริมจมูก  
• ตาสองชั้น  
• คาง / กราม  
• ศัลยกรรมอื่น ๆ  

เดี๋ยวแนะนำข้อมูลให้ตรงที่สุดค่ะ 💕`;
}

/**
 * Template 1: คำถามกว้าง (fallback - route ตาม service category)
 * ใช้เมื่อ: stage = exploring, service ยังไม่ชัด
 * ✅ FIX 3: Route template ตาม "หมวด service" ไม่ใช่ intent อย่างเดียว
 */
export function templateExploring(state: ConversationState): string {
  // ถ้ามี service ที่เป็น surgery → ใช้ templateExploringSurgery
  if (state.service === "surgery") {
    return templateExploringSurgery(state);
  }
  
  // Default: ใช้ templateExploringSkin (หัตถการผิว)
  return templateExploringSkin(state);
}

/**
 * Template 2: เลือกบริการแล้ว แต่ยังไม่เลือกบริเวณ
 * ใช้เมื่อ: stage = service_selected
 * 🧩 FIX 1: FIXED AREA SERVICE — ถ้า service มี FIXED AREA → ❌ ห้ามถาม area
 */
export function templateServiceSelected(state: ConversationState): string {
  // 🔧 FIX 2: templateServiceSelected ห้ามถาม area ถ้ามีแล้ว
  // ✅ ถ้า service + area ครบแล้ว → ใช้ templatePricing เสมอ
  // ❌ ห้ามถามซ้ำ
  // ❌ ห้าม UX แปลก
  if (state.service && state.area && state.area !== "unknown") {
    // มีทั้ง service และ area แล้ว → ใช้ templatePricing
    return templatePricing(state);
  }
  
  // 🧩 FIX 1: Guard — ถ้า service มี FIXED AREA → ใช้ templatePricing แทน
  if (state.service) {
    const fixedArea = hasFixedArea(state.service);
    if (fixedArea) {
      // มี FIXED AREA → ไม่ต้องถาม area → ใช้ templatePricing
      return templatePricing({
        ...state,
        area: fixedArea,
      });
    }
  }
  
  const serviceInfo = state.service ? getServiceKnowledge(state.service, state.area) : null;
  const serviceName = state.service === "filler" ? "ฟิลเลอร์" 
    : state.service === "rejuran" ? "รีจูรัน"
    : state.service === "botox" ? "โบท็อกซ์"
    : state.service === "laser" ? "เลเซอร์"
    : state.service === "surgery" ? "เสริมจมูก"
    : state.service === "skin" ? "ทรีตเมนต์"
    : state.service === "lifting" ? "ยกหน้า"
    : String(state.service);

  if (serviceInfo && serviceInfo.areas.length > 0) {
    const areaNames = serviceInfo.areas.map(a => 
      a === "lip" ? "ปาก" :
      a === "chin" ? "คาง" :
      a === "under_eye" ? "ใต้ตา" :
      a === "forehead" ? "หน้าผาก" :
      a === "brow" ? "คิ้ว" :
      a === "jaw" ? "กราม" :
      a === "cheek" ? "แก้ม" :
      a === "face" ? "ทั้งหน้า" : a
    ).join(" ");

    return `ได้เลยค่ะ 😊  
บริการ ${serviceName} สามารถทำได้หลายบริเวณเลยค่ะ  
สนใจทำตรงไหนเป็นพิเศษคะ เช่น ${areaNames}  
เดี๋ยวแอดมินเช็กให้ตรงจุดค่ะ ✨`;
  }

  return `ได้เลยค่ะ 😊  
บริการ ${serviceName} สามารถทำได้หลายบริเวณเลยค่ะ  
สนใจทำตรงไหนเป็นพิเศษคะ เดี๋ยวแอดมินเช็กให้ตรงจุดค่ะ ✨`;
}

/**
 * Template 3: พร้อมราคา / โปร
 * ใช้เมื่อ: stage = pricing, มีทั้ง service + area
 */
export function templatePricing(state: ConversationState): string {
  // ⚠️ Guard: ถ้าไม่มี service จริง → ใช้ template exploring (ห้ามเดา)
  if (!state.service) {
    return templateExploring(state);
  }
  
  const serviceInfo = getServiceKnowledge(state.service, state.area);
  if (!serviceInfo) return templateServiceSelected(state);

  const serviceName = state.service === "filler" ? "ฟิลเลอร์" 
    : state.service === "rejuran" ? "รีจูรัน"
    : state.service === "botox" ? "โบท็อกซ์"
    : state.service === "laser" ? "เลเซอร์"
    : state.service === "surgery" ? "เสริมจมูก"
    : state.service === "skin" ? "ทรีตเมนต์"
    : state.service === "lifting" ? "ยกหน้า"
    : String(state.service);

  const areaName = state.area === "lip" ? "ปาก"
    : state.area === "chin" ? "คาง"
    : state.area === "nose" ? "จมูก"
    : state.area === "under_eye" ? "ใต้ตา"
    : state.area === "forehead" ? "หน้าผาก"
    : state.area === "brow" ? "คิ้ว"
    : state.area === "jaw" ? "กราม"
    : state.area === "cheek" ? "แก้ม"
    : state.area === "face" ? "ทั้งหน้า"
    : "";

  // ถ้าไม่มี area → แสดงราคาแบบกว้าง ๆ และถามบริเวณ
  if (!areaName) {
    const areaOptions = serviceInfo.areas.slice(0, 3).map(a => 
      a === "lip" ? "ปาก" 
      : a === "chin" ? "คาง" 
      : a === "under_eye" ? "ใต้ตา"
      : a === "forehead" ? "หน้าผาก"
      : a === "brow" ? "คิ้ว"
      : a === "face" ? "ทั้งหน้า"
      : a
    ).join(" ");

    return `ได้เลยค่ะ 😊 ${serviceName}ราคา${serviceInfo.priceRange}ค่ะ  
${serviceInfo.note ? `${serviceInfo.note} ` : ""}ทำได้หลายบริเวณ เช่น ${areaOptions}  

สนใจทำบริเวณไหนเป็นพิเศษคะ เดี๋ยวเช็กโปรให้ตรงกับที่ต้องการค่ะ ✨`;
  }

  // มีทั้ง service + area → แสดงราคา/โปรเต็ม
  // 🧩 FIX 3: Template Pricing ต้องรู้จัก "Surgery" — แสดงข้อความเฉพาะสำหรับเสริมจมูก
  // ❌ ไม่โชว์ราคาเลขมั่ว
  // ✅ เป็นธรรมชาติแบบคลินิกจริง
  // หลักการ: ราคา ≠ โปรโมชัน (แยกกันชัดเจน)
  
  if (state.service === "surgery" && state.area === "nose") {
    const tone = state.tone || "short"; // default = short
    
    // ✅ Human First Rule: ถ้ามี preference แล้ว → ให้ข้อมูลได้
    // แต่ถ้ายังไม่มี preference → ถามก่อน (ไม่เทข้อมูล)
    if (!state.preference?.style) {
      // ยังไม่มี preference → ถามก่อน
      return templateAskNosePreference();
    }
    
    // ✅ Tone Check: ถ้า tone = short → ประโยคเดียว / ไม่อธิบาย
    if (tone === "short") {
      return `ได้เลยค่ะ 😊`;
    }
    
    // มี preference แล้ว → ให้ข้อมูลตาม preference
    const style = state.preference.style;
    const concern = state.preference.concern;
    const intensity = state.preference.intensity;
    
    // ให้ข้อมูลสั้น ๆ ตาม preference (ไม่เทข้อมูลทั้งหมด)
    let responseText = `ได้เลยค่ะ 😊`;
    
    // 🔵 โหมด 3: ถามจริง → อธิบายสั้น ๆ (ไม่วิชาการ)
    if (tone === "explain") {
      if (style === "โด่ง") {
        responseText += `\nถ้าชอบทรงจมูกแบบโด่ง จะมีเทคนิคให้เลือกหลายแบบเลยค่ะ เช่น การปรับสันให้คมขึ้น หรือเน้นปลายให้พุ่งรับกับรูปหน้า`;
      } else if (style === "ธรรมชาติ") {
        responseText += `\nถ้าชอบทรงจมูกแบบธรรมชาติ จะเน้นความสวยที่ดูเป็นธรรมชาติ ไม่โดดเด่นเกินไปค่ะ`;
      } else if (style === "สายเกาหลี") {
        responseText += `\nถ้าชอบสไตล์สายเกาหลี จะเน้นความสวยที่ดูน่ารัก โด่งเล็กน้อยค่ะ`;
      }
      
      if (intensity === "เบา" || intensity === "ไม่เวอร์") {
        responseText += `\nเรื่องความเบา ไม่เวอร์ แอดมินเข้าใจค่ะ คุณหมอจะแนะนำเทคนิคที่เหมาะสมและดูเป็นธรรมชาติค่ะ`;
      }
      
      if (concern) {
        responseText += `\nเรื่อง${concern} แอดมินเข้าใจค่ะ คุณหมอจะแนะนำเทคนิคที่เหมาะสมและปลอดภัยที่สุดค่ะ`;
      }
      
      responseText += `\n\nเดี๋ยวต้องให้คุณหมอประเมินโครงสร้างจริงอีกทีนะคะ 😊`;
    } else {
      // tone = medium → อธิบายได้ 1 ประโยค
      if (style === "ธรรมชาติ") {
        responseText += `\nทรงธรรมชาติจะเน้นให้เข้ากับหน้า ดูไม่หลอกค่ะ`;
      } else if (style === "โด่ง") {
        responseText += `\nทรงโด่งจะเน้นความคมชัดค่ะ`;
      } else if (style === "สายเกาหลี") {
        responseText += `\nสไตล์เกาหลีจะเน้นความน่ารักค่ะ`;
      }
      
      responseText += `\n\nเดี๋ยวต้องให้คุณหมอประเมินโครงสร้างจริงอีกทีนะคะ 😊`;
    }
    
    return responseText;
  }
  
  // ถ้าเป็น surgery อื่น ๆ (ยังไม่มี template เฉพาะ)
  if (state.service === "surgery") {
    return `ได้เลยค่ะ 😊  
${serviceName} มีหลายเทคนิค ขึ้นกับเป้าหมายและโครงสร้างเดิมค่ะ  

ราคาจะขึ้นอยู่กับเทคนิค แพทย์ และวัสดุที่ใช้ แนะนำเข้ามาปรึกษาคุณหมอก่อนนะคะ  

สนใจแนวไหนเป็นพิเศษคะ หรืออยากให้คุณหมอประเมินก่อนก็ได้เลยค่ะ 💕`;
  }

  // หัตถการทั่วไป — แสดงราคา + บอกว่าขึ้นกับอะไร
  // ถ้ามีโปร → แสดงโปรแยก (ไม่ปนกับราคา)
  const priceText = serviceInfo.priceNote 
    ? `${serviceInfo.priceRange} (${serviceInfo.priceNote})`
    : serviceInfo.priceRange;
  
  const promotionText = serviceInfo.promotion 
    ? `\n\nตอนนี้${serviceInfo.promotion}${serviceInfo.promotionCondition ? ` (${serviceInfo.promotionCondition})` : ""}`
    : "";
  
  return `ได้เลยค่ะ 😊  
${serviceName} บริเวณ ${areaName}  
ราคาเริ่มต้นประมาณ ${priceText}ค่ะ${promotionText}  

ถ้าสนใจจองคิว บอกวันเวลาที่สะดวกได้เลยค่ะ 💕`;
}

/**
 * Template 4: คำตอบสั้นต่อบทสนทนา (เช่น "รีจูรันครับ")
 * ใช้เมื่อ: isShortFollowUp = true
 */
export function templateShortFollowUp(
  message: string,
  state: ConversationState
): string {
  // พยายามหา service จากข้อความ
  const lower = message.toLowerCase();
  let detectedService: ServiceCategory | null = null;
  
  if (/รีจูรัน|rejuran/.test(lower)) detectedService = "rejuran";
  else if (/ฟิลเลอร์|filler/.test(lower)) detectedService = "filler";
  else if (/โบท็อกซ์|botox/.test(lower)) detectedService = "botox";
  else if (/เลเซอร์|laser/.test(lower)) detectedService = "laser";
  else if (/ทรีตเมนต์|facial/.test(lower)) detectedService = "skin";
  else if (/ยก|hifu|ultra/.test(lower)) detectedService = "lifting";

  // ถ้าเจอ service จากข้อความ → ใช้ service นั้น
  // ถ้าไม่เจอ แต่ state มี service → ใช้ service จาก state
  const serviceToUse = detectedService || (state.service as ServiceCategory) || null;

  if (serviceToUse) {
    const serviceInfo = getServiceKnowledge(serviceToUse, state.area);
    if (serviceInfo) {
      const serviceName = serviceToUse === "filler" ? "ฟิลเลอร์" 
        : serviceToUse === "rejuran" ? "รีจูรัน"
        : serviceToUse === "botox" ? "โบท็อกซ์"
        : serviceToUse === "laser" ? "เลเซอร์"
        : serviceToUse === "skin" ? "ทรีตเมนต์"
        : serviceToUse === "lifting" ? "ยกหน้า"
        : String(serviceToUse);

      const areaText = serviceInfo.areas.length > 1 
        ? "หลายบริเวณ เช่น " + serviceInfo.areas.slice(0, 3).map(a => 
            a === "lip" ? "ปาก" 
            : a === "chin" ? "คาง" 
            : a === "under_eye" ? "ใต้ตา"
            : a === "forehead" ? "หน้าผาก"
            : a === "brow" ? "คิ้ว"
            : a === "face" ? "ทั้งหน้า"
            : a
          ).join(" ")
        : "บริเวณ" + (serviceInfo.areas[0] === "face" ? "ทั้งหน้า" : "");

      return `ได้เลยค่ะ 😊 ${serviceName}${serviceInfo.description ? ` ${serviceInfo.description}` : ""}  
ปกติทำได้${areaText}นะคะ  
สนใจทำบริเวณไหน เดี๋ยวเช็กราคาและโปรให้ค่ะ ✨`;
    }
  }

  // ถ้าไม่มี service → ใช้ template exploring
  return templateExploring(state);
}

/**
 * Template 5: การแพทย์ (ห้าม AI ตัดสินใจเอง)
 * 6️⃣ medical_question / aftercare_question
 * กติกา:
 * ❌ ห้ามใช้ context การขาย
 * ❌ ห้ามพูดโปร
 * ✅ ปลอบก่อน + ส่งหมอ / ข้อมูลแพทย์เท่านั้น
 */
export function templateMedical(): string {
  return `เข้าใจค่ะ 😊  
อาการลักษณะนี้แนะนำให้คุณหมอประเมินโดยตรงจะปลอดภัยที่สุดค่ะ  
เดี๋ยวแอดมินช่วยนัดคุณหมอให้ได้นะคะ 💕`;
}

/**
 * Template 7: service_information (ทำอะไรได้บ้าง / ต่างกันยังไง)
 * 2️⃣ service_information
 * กติกา:
 * - ถ้ามี service → อธิบาย service นั้น (ให้ข้อมูล อย่าขายทันที)
 * - ถ้าไม่มี service → แสดง option แบบกว้าง
 * ❌ ห้ามขาย
 * ❌ ห้ามพูดราคา (ยกเว้นลูกค้าถาม)
 */
export function templateServiceInformation(state: ConversationState): string {
  if (state.service) {
    // 🔵 โหมด 3: ถามจริง → ค่อยอธิบาย (ไม่วิชาการ)
    // ถ้าลูกค้าถามข้อมูลโดยตรง (service_information intent) → ให้ข้อมูลได้
    
    const tone = state.tone || "short"; // default = short
    const serviceInfo = getServiceKnowledge(state.service, state.area);
    if (serviceInfo) {
      const serviceName = state.service === "filler" ? "ฟิลเลอร์" 
        : state.service === "rejuran" ? "รีจูรัน"
        : state.service === "botox" ? "โบท็อกซ์"
        : state.service === "laser" ? "เลเซอร์"
        : state.service === "surgery" && state.area === "nose" ? "เสริมจมูก"
        : state.service === "surgery" && state.area === "eye" ? "ตาสองชั้น"
        : state.service === "surgery" ? "ศัลยกรรม"
        : state.service === "skin" ? "ทรีตเมนต์"
        : state.service === "lifting" ? "ยกหน้า"
        : String(state.service);
      
      // ✅ Tone Check: ถ้า tone = short → ประโยคเดียว / ไม่อธิบาย
      if (tone === "short" && state.service === "surgery") {
        return `ได้เลยค่ะ 😊`;
      }
      
      // 🔵 โหมด 3: ถามจริง → อธิบายสั้น ๆ (ไม่วิชาการ)
      // สำหรับศัลยกรรม: ถ้ามี preference → ให้ข้อมูลตาม preference
      if (state.service === "surgery" && state.area === "nose" && state.preference?.style) {
        const style = state.preference.style;
        let infoText = `${serviceName}`;
        
        // tone = explain → อธิบายได้, tone = medium → อธิบาย 1 ประโยค
        if (tone === "explain") {
          if (style === "ธรรมชาติ") {
            infoText += ` ทรงธรรมชาติจะเน้นให้เข้ากับหน้า ดูไม่หลอกค่ะ`;
          } else if (style === "โด่ง" || style === "ปลายพุ่ง") {
            infoText += ` ทรงโด่งจะเน้นความคมชัดค่ะ`;
          } else if (style === "สายเกาหลี") {
            infoText += ` สไตล์เกาหลีจะเน้นความน่ารักค่ะ`;
          }
          infoText += ` เดี๋ยวต้องให้คุณหมอประเมินโครงสร้างจริงอีกทีนะคะ 😊`;
        } else if (tone === "medium") {
          if (style === "ธรรมชาติ") {
            infoText += ` ทรงธรรมชาติจะเน้นให้เข้ากับหน้า ดูไม่หลอกค่ะ`;
          } else if (style === "โด่ง") {
            infoText += ` ทรงโด่งจะเน้นความคมชัดค่ะ`;
          } else if (style === "สายเกาหลี") {
            infoText += ` สไตล์เกาหลีจะเน้นความน่ารักค่ะ`;
          }
          infoText += ` 😊`;
        }
        
        return infoText;
      }
      
      // สำหรับศัลยกรรมอื่น ๆ หรือไม่มี preference → ให้ข้อมูลสั้น ๆ
      if (state.service === "surgery") {
        if (tone === "short") {
          return `ได้เลยค่ะ 😊`;
        }
        return `${serviceName} เดี๋ยวต้องให้คุณหมอประเมินโครงสร้างจริงอีกทีนะคะ 😊`;
      }
      
      // บริการอื่น ๆ → ให้ข้อมูลปกติ (สั้น)
      let infoText = `${serviceName} ${serviceInfo.description}`;
      
      if (serviceInfo.suitableFor) {
        infoText += ` เหมาะกับ: ${serviceInfo.suitableFor}`;
      }
      
      return `ได้เลยค่ะ 😊  
${infoText}  

${serviceInfo.note ? `${serviceInfo.note} ` : ""}ถ้าสนใจสอบถามรายละเอียดเพิ่มเติม หรืออยากดูราคา/โปรโมชั่น บอกได้เลยค่ะ ✨`;
    }
  }
  
  // ไม่มี service → แสดง option แบบกว้าง (ใช้ templateExploring)
  return templateExploring(state);
}

/**
 * Template 9: comparison_inquiry (เปรียบเทียบบริการ)
 * 🔧 เพิ่ม: comparison_inquiry
 * กติกา:
 * - เปรียบเทียบแบบเป็นกลาง ไม่ฟันธง
 * - ปิดด้วย "ขึ้นกับปัญหาผิว / แนะนำประเมิน"
 */
export function templateComparison(state: ConversationState, userMessage: string): string {
  // พยายามหา service ที่ถูกเปรียบเทียบจากข้อความ
  const lower = userMessage.toLowerCase();
  const services: Array<{ name: string; info: ReturnType<typeof getServiceKnowledge> }> = [];
  
  if (/ฟิลเลอร์|filler/.test(lower)) {
    const info = getServiceKnowledge("filler");
    if (info) services.push({ name: "ฟิลเลอร์", info });
  }
  if (/โบท็อกซ์|botox/.test(lower)) {
    const info = getServiceKnowledge("botox");
    if (info) services.push({ name: "โบท็อกซ์", info });
  }
  if (/รีจูรัน|rejuran/.test(lower)) {
    const info = getServiceKnowledge("rejuran");
    if (info) services.push({ name: "รีจูรัน", info });
  }
  if (/เลเซอร์|laser/.test(lower)) {
    const info = getServiceKnowledge("laser");
    if (info) services.push({ name: "เลเซอร์", info });
  }
  if (/ยก|hifu|ultra/.test(lower)) {
    const info = getServiceKnowledge("lifting");
    if (info) services.push({ name: "ยกหน้า", info });
  }
  if (/ร้อยไหม/.test(lower)) {
    // ร้อยไหมยังไม่มีใน knowledge base → ใช้ข้อมูลทั่วไป
    services.push({ name: "ร้อยไหม", info: null });
  }
  
  if (services.length >= 2) {
    // เปรียบเทียบแบบเป็นกลาง ไม่ฟันธง
    let comparisonText = `${services[0].name} ${services[0].info?.description || "ช่วยปรับรูปหน้า"}`;
    if (services[0].info?.suitableFor) {
      comparisonText += ` เหมาะกับ${services[0].info.suitableFor}`;
    }
    
    comparisonText += `\n\n${services[1].name} ${services[1].info?.description || "ช่วยปรับรูปหน้า"}`;
    if (services[1].info?.suitableFor) {
      comparisonText += ` เหมาะกับ${services[1].info.suitableFor}`;
    }
    
    return `ได้เลยค่ะ 😊  
${services[0].name} และ ${services[1].name} มีจุดเด่นต่างกันค่ะ  

${comparisonText}

จริงๆ แล้วขึ้นกับปัญหาผิวและเป้าหมายที่ต้องการค่ะ  
แนะนำเข้ามาปรึกษาคุณหมอก่อนนะคะ จะได้แนะนำให้เหมาะที่สุดค่ะ 💕`;
  }
  
  // ถ้าไม่เจอ service ชัดเจน → ถามกลับ
  return `ได้เลยค่ะ 😊  
รบกวนบอกเพิ่มนิดนึงนะคะ ว่าอยากเปรียบเทียบระหว่างบริการไหน  
เดี๋ยวแอดมินช่วยอธิบายให้เห็นความต่างชัดเจนค่ะ ✨`;
}

/**
 * Template 10: hesitation (ความลังเล/กลัว)
 * 🔧 เพิ่ม: hesitation
 * กติกา:
 * - รับอารมณ์ (สำคัญมาก) — normalize ความกลัว
 * - ให้ข้อมูลสั้น
 * - ชวนคุยต่อ ไม่เร่งขาย
 */
export function templateHesitation(state: ConversationState, userMessage: string): string {
  const lower = userMessage.toLowerCase();
  
  // รับอารมณ์ก่อน
  let empathyText = "เข้าใจค่ะ 😊";
  if (/กลัว/.test(lower)) {
    empathyText = "เข้าใจความกังวลค่ะ 😊";
  } else if (/ลังเล|ไม่กล้า/.test(lower)) {
    empathyText = "เข้าใจค่ะ 😊";
  } else if (/เคยเห็น|เคสหลุด|พัง/.test(lower)) {
    empathyText = "เข้าใจความกังวลค่ะ 😊";
  }
  
  // Normalize ความกลัว
  let normalizeText = "จริงๆ แล้วการทำหัตถการความงามมีความปลอดภัยสูงค่ะ";
  if (state.service === "surgery") {
    normalizeText = "จริงๆ แล้วการทำศัลยกรรมมีความปลอดภัยสูงค่ะ แต่ต้องเลือกแพทย์และคลินิกที่เชื่อถือได้";
    // เมื่อลูกค้ากลัวเจ็บ — ระบุว่ามียาชา/sedation
    if (/เจ็บ/.test(lower)) {
      normalizeText += "\nเรื่องความเจ็บ มีการให้ยาชาค่ะ คุณหมอจะดูแลให้สบายที่สุด";
    }
  }
  
  // ให้ข้อมูลสั้น
  let infoText = "";
  if (state.service) {
    const serviceInfo = getServiceKnowledge(state.service, state.area);
    if (serviceInfo && serviceInfo.risks) {
      infoText = `\n${serviceInfo.risks}`;
    }
  }
  
  // ชวนคุยต่อ ไม่เร่งขาย
  return `${empathyText}  
${normalizeText}${infoText}  

ถ้าสนใจสอบถามเพิ่มเติม หรืออยากเข้ามาปรึกษาคุณหมอก่อนตัดสินใจ บอกได้เลยค่ะ  
แอดมินพร้อมช่วยแนะนำให้ค่ะ 💕`;
}

/**
 * Template 8: availability_check (คิวว่าง)
 * 4️⃣ availability_check
 * กติกา:
 * ❌ templatePricing (ห้ามเด็ดขาด)
 * ❌ แสดงราคา (ห้ามเด็ดขาด)
 * ✅ templateAvailability เท่านั้น — ถามวัน/ช่วงเวลา
 */
export function templateAvailability(state: ConversationState): string {
  if (!state.service) {
    return `ได้เลยค่ะ 😊  
รบกวนแจ้งวันที่หรือช่วงเวลาที่สะดวกมาได้เลยนะคะ  
แอดมินจะเช็กคิวที่ใกล้ที่สุดให้ค่ะ 💕`;
  }
  
  const serviceName = state.service === "filler" ? "ฟิลเลอร์" 
    : state.service === "rejuran" ? "รีจูรัน"
    : state.service === "botox" ? "โบท็อกซ์"
    : state.service === "laser" ? "เลเซอร์"
    : state.service === "surgery" ? "เสริมจมูก"
    : state.service === "skin" ? "ทรีตเมนต์"
    : state.service === "lifting" ? "ยกหน้า"
    : String(state.service);
  
  const areaName = state.area === "lip" ? "ปาก"
    : state.area === "chin" ? "คาง"
    : state.area === "under_eye" ? "ใต้ตา"
    : state.area === "forehead" ? "หน้าผาก"
    : state.area === "brow" ? "คิ้ว"
    : state.area === "jaw" ? "กราม"
    : state.area === "cheek" ? "แก้ม"
    : state.area === "face" ? "ทั้งหน้า"
    : state.area === "nose" ? "จมูก"
    : "";
  
  if (areaName) {
    return `ได้เลยค่ะ 😊  
รบกวนแจ้งวันที่หรือช่วงเวลาที่สะดวกสำหรับ ${serviceName} บริเวณ ${areaName} มาได้เลยนะคะ  
แอดมินจะเช็กคิวที่ใกล้ที่สุดให้ค่ะ 💕`;
  }
  
  return `ได้เลยค่ะ 😊  
รบกวนแจ้งวันที่หรือช่วงเวลาที่สะดวกสำหรับ ${serviceName} มาได้เลยนะคะ  
แอดมินจะเช็กคิวที่ใกล้ที่สุดให้ค่ะ 💕`;
}

/**
 * Template 11: refinement (การปรับแต่ง/เลือกสไตล์)
 * 🔧 FIX 1: refinement — ข้อความสั้น ๆ ต่อจากบริการเดิม
 * กติกา:
 * - ไม่ต้องรู้เทคนิคละเอียด
 * - ไม่เดา
 * - ไม่ย้อนหมวด
 * - แนะนำให้ปรึกษาแพทย์
 */
export function templateRefinement(
  state: ConversationState,
  message: string
): string {
  const lower = message.toLowerCase();
  
  // ตรวจสอบว่าเป็น refinement อะไร
  let refinementType = "";
  if (/โด่ง|พุ่ง/.test(lower)) {
    refinementType = "โด่ง";
  } else if (/ธรรมชาติ/.test(lower)) {
    refinementType = "ธรรมชาติ";
  } else if (/สายเกาหลี/.test(lower)) {
    refinementType = "สายเกาหลี";
  } else if (/สายฝอ/.test(lower)) {
    refinementType = "สายฝอ";
  } else if (/คม/.test(lower)) {
    refinementType = "คม";
  } else if (/หวาน/.test(lower)) {
    refinementType = "หวาน";
  }
  
  const serviceName = state.service === "surgery" && state.area === "nose" 
    ? "จมูก"
    : state.service === "filler" ? "ฟิลเลอร์"
    : state.service === "rejuran" ? "รีจูรัน"
    : state.service === "botox" ? "โบท็อกซ์"
    : state.service === "laser" ? "เลเซอร์"
    : String(state.service);
  
  // ✅ Human First Rule: ถ้าเป็น surgery + nose และมี preference แล้ว
  // → ให้ข้อมูลสั้น ๆ ตาม preference (ไม่เทข้อมูลทั้งหมด)
  if (state.service === "surgery" && state.area === "nose") {
    const tone = state.tone || "short"; // default = short
    
    // ✅ Tone Check: ถ้า tone = short → ประโยคเดียว / ไม่อธิบาย
    if (tone === "short") {
      return `ได้เลยค่ะ 😊`;
    }
    
    const style = state.preference?.style || refinementType;
    const concern = state.preference?.concern;
    const intensity = state.preference?.intensity;
    
    let responseText = `ได้เลยค่ะ 😊`;
    
    // tone = explain → อธิบายได้, tone = medium → อธิบาย 1 ประโยค
    if (tone === "explain") {
      if (style === "โด่ง") {
        responseText += `\nถ้าชอบทรงจมูกแบบโด่ง จะมีเทคนิคให้เลือกหลายแบบเลยค่ะ เช่น การปรับสันให้คมขึ้น หรือเน้นปลายให้พุ่งรับกับรูปหน้า`;
      } else if (style === "ธรรมชาติ") {
        responseText += `\nถ้าชอบทรงจมูกแบบธรรมชาติ จะเน้นความสวยที่ดูเป็นธรรมชาติ ไม่โดดเด่นเกินไปค่ะ`;
      } else if (style === "สายเกาหลี") {
        responseText += `\nถ้าชอบสไตล์สายเกาหลี จะเน้นความสวยที่ดูน่ารัก โด่งเล็กน้อยค่ะ`;
      } else if (refinementType) {
        responseText += `\nเข้าใจความต้องการแล้วค่ะ จะมีเทคนิคให้เลือกหลายแบบเลยค่ะ`;
      }
      
      if (intensity === "เบา" || intensity === "ไม่เวอร์") {
        responseText += `\nเรื่องความเบา ไม่เวอร์ แอดมินเข้าใจค่ะ คุณหมอจะแนะนำเทคนิคที่เหมาะสมและดูเป็นธรรมชาติค่ะ`;
      }
      
      if (concern) {
        responseText += `\nเรื่อง${concern} แอดมินเข้าใจค่ะ คุณหมอจะแนะนำเทคนิคที่เหมาะสมและปลอดภัยที่สุดค่ะ`;
      }
      
      responseText += `\n\nเดี๋ยวต้องให้คุณหมอประเมินโครงสร้างจริงอีกทีนะคะ 😊`;
    } else if (tone === "medium") {
      // tone = medium → อธิบายได้ 1 ประโยค
      if (style === "ธรรมชาติ") {
        responseText += `\nทรงธรรมชาติจะเน้นให้เข้ากับหน้า ดูไม่หลอกค่ะ`;
      } else if (style === "โด่ง") {
        responseText += `\nทรงโด่งจะเน้นความคมชัดค่ะ`;
      } else if (style === "สายเกาหลี") {
        responseText += `\nสไตล์เกาหลีจะเน้นความน่ารักค่ะ`;
      }
      responseText += ` 😊`;
    }
    
    return responseText;
  }
  
  // บริการอื่น ๆ
  return `ได้เลยค่ะ 😊  
${refinementType ? `ถ้าชอบ${refinementType} ` : ""}จะมีเทคนิคให้เลือกหลายแบบเลยค่ะ  
แนะนำให้คุณหมอประเมินก่อนนะคะ  

แอดมินช่วยนัดคิวปรึกษาให้ได้เลยค่ะ 💕`;
}

/**
 * Template 12a: ถาม preference สำหรับเสริมจมูก (แบบคน - แชทใหม่)
 * ✅ Human First Rule: ถามแบบคน ไม่ใช่ถามแบบข้อมูล
 * ใช้เมื่อ: เพิ่งรู้ว่าเป็นจมูก แต่ยังไม่มี preference (แชทใหม่)
 * 
 * 🟢 โหมด 1: แค่ทัก / สนใจ → ถามสั้น ๆ 1 คำถาม
 * 
 * กฎเหล็ก:
 * - ไม่มี bullet
 * - ไม่มีคำว่า "กังวล / ประเมิน / เคส"
 * - เหมือนแอดมินพิมพ์สด
 * - ประโยคสั้น ไม่มีโครงสร้าง
 */
export function templateAskNosePreferenceHuman(): string {
  return `ได้เลยค่ะ 😊  
อยากได้ทรงประมาณไหนคะ ธรรมชาติหรือเกาหลีดีคะ`;
}

/**
 * Template สำหรับศัลยกรรมตา (ทำตา)
 * 🟢 โหมด 1: แค่ทัก / สนใจ → ถามสั้น ๆ 1 คำถาม
 */
export function templateAskEyePreferenceHuman(): string {
  return `ได้เลยค่ะ 😊  
สนใจตาสองชั้นแบบไหนคะ ชั้นเล็ก ธรรมชาติ หรือคมชัดคะ`;
}

/**
 * Template 12: ถาม preference สำหรับเสริมจมูก (แบบข้อมูล - คุยต่อแล้ว)
 * ✅ Human First Rule: ถามก่อนอธิบาย
 * ใช้เมื่อ: service = surgery, area = nose, แต่ยังไม่มี preference.style (คุยไปแล้ว)
 * 
 * กฎเหล็ก:
 * - ถ้าลูกค้าไม่ได้ขอข้อมูล → ห้ามอธิบาย
 * - ลูกค้าแค่ "บอกความสนใจ" → ถามให้ชัดก่อน 1-2 จุด
 * - ไม่ใช่โชว์ความรู้
 * - ❌ ไม่มีเทคนิค
 * - ❌ ไม่มีวัสดุ
 * - ❌ ไม่มีราคา
 * - ✅ เหมือนแอดมินจริง
 * - ✅ พูดสั้น เป็นกันเอง ไม่เชิงวิชาการ
 */
export function templateAskNosePreference(): string {
  return `ได้เลยค่ะ 😊  
ขอถามเพิ่มนิดนึงนะคะ อยากได้ทรงประมาณไหนคะ  

เช่น  
• ธรรมชาติ  
• ปลายพุ่ง  
• สายเกาหลี  

หรือมีปัญหาจมูกเดิมที่กังวลเป็นพิเศษไหมคะ  
เดี๋ยวแอดมินช่วยดูให้เหมาะกับเคสค่ะ 💕`;
}

/**
 * Template 12b: Acknowledge + ถามต่อหลังจากได้ style แล้ว
 * ✅ Human First Rule: acknowledge ก่อนถาม
 * ใช้เมื่อ: ลูกค้าตอบ preference (เช่น "ธรรมชาติ") → ต้อง acknowledge + ถามต่อ
 * 
 * กฎเหล็ก:
 * - acknowledge สิ่งที่ลูกค้าพูด
 * - ถามต่อ 1 จุดเท่านั้น
 * - ไม่มี bullet
 * - ไม่มีขาย
 * - ไม่มีวิชาการ
 * - เหมือนแอดมินจริง
 */
export function templateAfterNosePreference(state: ConversationState): string {
  const style = state.preference?.style || "";
  const tone = state.tone || "short"; // default = short
  
  // ✅ Tone Check: ถ้า tone = short → ประโยคเดียว / ไม่อธิบาย
  if (tone === "short") {
    return `ได้เลยค่ะ 😊`;
  }
  
  // Acknowledge + ถามต่อ (แบบคน ไม่มี bullet)
  // 🟡 โหมด 2: เลือกแล้ว แต่ยังไม่ถาม → รับรู้ + ถามต่อเบา ๆ
  if (style === "ธรรมชาติ") {
    return `ได้เลยค่ะ 😊  
มีจุดไหนของจมูกที่กังวลเป็นพิเศษไหมคะ หรืออยากได้ประมาณไหนคะ`;
  } else if (style === "โด่ง" || style === "ปลายพุ่ง") {
    return `ได้เลยค่ะ 😊  
มีจุดไหนของจมูกที่กังวลเป็นพิเศษไหมคะ หรืออยากได้ประมาณไหนคะ`;
  } else if (style === "สายเกาหลี") {
    return `ได้เลยค่ะ 😊  
มีจุดไหนของจมูกที่กังวลเป็นพิเศษไหมคะ หรืออยากได้ประมาณไหนคะ`;
  } else {
    return `ได้เลยค่ะ 😊  
มีจุดไหนของจมูกที่กังวลเป็นพิเศษไหมคะ หรืออยากได้ประมาณไหนคะ`;
  }
}

/**
 * Template 12c: ถามต่อหลังจากได้ style แล้ว (เดิม - ใช้เมื่อมี style แล้ว)
 * ✅ Human First Rule: ถามทีละคำถาม
 * ใช้เมื่อ: มี preference.style แล้ว แต่ยังไม่มี preference.intensity
 * 
 * กฎเหล็ก:
 * - ตอบสั้น และถามต่อแบบเพื่อนคุยกัน
 * - ไม่มีคำแพทย์
 * - ไม่มีการสอน
 * - เป้าหมายคือให้ลูกค้าพิมพ์ต่อ
 */
export function templateNoseStyleFollowup(state: ConversationState): string {
  const style = state.preference?.style || "";
  const tone = state.tone || "short"; // default = short
  
  // ✅ Tone Check: ถ้า tone = short → ประโยคเดียว / ไม่อธิบาย
  if (tone === "short") {
    return `ได้เลยค่ะ 😊`;
  }
  
  // ตอบสั้นตาม style ที่ลูกค้าบอก (แบบคน ไม่มี bullet)
  let responseText = `โอเคเลยค่ะ 😊`;
  
  if (style === "ธรรมชาติ") {
    responseText += `\nประมาณธรรมชาติเอาละมุน ๆ ใช่ไหมคะ หรืออยากได้สันชัดขึ้นนิดนึง 💕`;
  } else if (style === "โด่ง" || style === "ปลายพุ่ง") {
    responseText += `\nแนวโด่งสวยมากเลยค่ะ อยากได้สันชัดแค่ไหนคะ หรือเอาธรรมชาติ ๆ ดีคะ 💕`;
  } else if (style === "สายเกาหลี") {
    responseText += `\nสไตล์เกาหลีน่ารักมากเลยค่ะ อยากได้สันชัดแค่ไหนคะ หรือเอาละมุน ๆ ดีคะ 💕`;
  } else {
    responseText += `\nเข้าใจแล้วค่ะ อยากได้สันชัดแค่ไหนคะ หรือเอาธรรมชาติ ๆ ดีคะ 💕`;
  }
  
  return responseText;
}

/**
 * Template 12b: ถาม preference สำหรับฟิลเลอร์/โบท็อกซ์
 * ✅ Human First Rule: ถามก่อนอธิบาย
 */
export function templateAskFillerBotoxPreference(): string {
  return `ได้เลยค่ะ 😊  
ขอทราบเพิ่มนิดนึงนะคะ ว่าอยากได้ผลลัพธ์แบบไหนคะ  

เช่น  
• เนียนธรรมชาติ  
• ชัดเจนขึ้น  
• หรือมีปัญหาที่อยากแก้เป็นพิเศษไหมคะ  

เดี๋ยวแอดมินแนะนำให้ตรงกับเคสมากที่สุดค่ะ 💕`;
}

/**
 * Template 12c: ถาม preference สำหรับทรีตเมนต์/เลเซอร์
 * ✅ Human First Rule: ถามก่อนอธิบาย
 */
export function templateAskTreatmentPreference(): string {
  return `ได้เลยค่ะ 😊  
ขอทราบเพิ่มนิดนึงนะคะ ว่ามีปัญหาผิวที่กังวลเป็นพิเศษไหมคะ  

เช่น  
• ฝ้า กระ  
• รูขุมขนกว้าง  
• สิว  
• หรืออยากเห็นผลระดับไหนคะ  

เดี๋ยวแอดมินแนะนำให้ตรงกับเคสมากที่สุดค่ะ 💕`;
}

/**
 * Template 13: ตอบสั้น ๆ เมื่อลูกค้าพิมพ์สั้น (Response Length Guard)
 * ✅ Human First Rule: ลูกค้าสั้น → บอทสั้น
 * ใช้เมื่อ: ลูกค้าพิมพ์ไม่เกิน 1-3 คำ และมี preference.style แล้ว
 * 
 * กฎเหล็ก:
 * - ห้ามอธิบายเชิงข้อมูล
 * - ห้ามใช้โทนให้ความรู้
 * - หน้าที่คือ "รับ + ถามต่อสั้น ๆ" เท่านั้น
 * - ❌ ไม่มีเทคนิค, วัสดุ, ประเมิน, วิชาการ
 * - ✅ มีแค่ รับ, คุย, ถามต่อ
 */
export function templateShortHumanFollowup(state: ConversationState, userMessage: string): string {
  const style = state.preference?.style || "";
  const lower = userMessage.toLowerCase().trim();
  
  // Detect style จาก user message ถ้ายังไม่มีใน preference
  let detectedStyle = style;
  if (!detectedStyle) {
    if (/ธรรมชาติ/.test(lower)) detectedStyle = "ธรรมชาติ";
    else if (/โด่ง|พุ่ง/.test(lower)) detectedStyle = "โด่ง";
    else if (/สายเกาหลี|เกาหลี/.test(lower)) detectedStyle = "สายเกาหลี";
    else if (/สายฝอ/.test(lower)) detectedStyle = "สายฝอ";
  }
  
  // ตอบสั้น ๆ ตาม style
  let responseText = `ได้เลยค่ะ 😊`;
  
  if (detectedStyle === "ธรรมชาติ") {
    responseText += `\nทรงธรรมชาติกำลังฮิตเลยค่ะ`;
  } else if (detectedStyle === "โด่ง" || detectedStyle === "ปลายพุ่ง") {
    responseText += `\nแนวโด่งสวยมากเลยค่ะ`;
  } else if (detectedStyle === "สายเกาหลี") {
    responseText += `\nสไตล์เกาหลีน่ารักมากเลยค่ะ`;
  } else {
    responseText += `\nเข้าใจแล้วค่ะ`;
  }
  
  // ถามต่อสั้น ๆ (1 คำถามเท่านั้น)
  responseText += `\n\nขอถามเพิ่มนิดนึงนะคะ อยากได้สันชัดประมาณไหนคะ หรือเอาเบา ๆ ดีคะ 💕`;
  
  return responseText;
}

/**
 * Template 6: ยังไม่พร้อมจอง (ไม่มี service หรือ area)
 */
export function templateBookingNotReady(state: ConversationState): string {
  if (!state.service) {
    return `รบกวนขอรายละเอียดเพิ่มนิดนึงนะคะ ว่าสนใจบริการไหน จะได้แนะนำให้ตรงจุดและเช็กคิวว่างให้ค่ะ 😊`;
  }
  if (!state.area) {
    const serviceName = state.service === "filler" ? "ฟิลเลอร์" 
      : state.service === "rejuran" ? "รีจูรัน"
      : state.service === "botox" ? "โบท็อกซ์"
      : state.service === "laser" ? "เลเซอร์"
      : String(state.service);
    return `ได้เลยค่ะ 😊 สนใจจอง${serviceName}ใช่ไหมคะ  
ขอทราบว่าสนใจทำบริเวณไหนเป็นพิเศษ จะได้เช็กคิวว่างให้ตรงกับที่ต้องการค่ะ ✨`;
  }
  return templateServiceSelected(state);
}

/**
 * เลือก template ตาม state และ intent
 * 🧠 FINAL FLOW: Select template ตาม intent (ไม่มั่ว)
 */
export function selectTemplate(
  state: ConversationState,
  userMessage: string,
  isFollowUp: boolean
): string {
  // 7️⃣ general_chat / short follow-up
  // กติกา: ถ้ามี state → treat เป็น continuation
  // ❌ ห้าม reset
  // ❌ ห้ามตอบลอย ๆ
  if (isFollowUp && state.stage !== "greeting") {
    return templateShortFollowUp(userMessage, state);
  }

  // 6️⃣ medical_question / aftercare_question
  if (state.stage === "medical") {
    return templateMedical();
  }

  if (state.stage === "waiting_admin") {
    return ""; // Bot หยุดพูด
  }

  // ✅ 4️⃣ Template Guard: กัน AI เดาแทนลูกค้า (สำคัญมาก)
  // กฎเหล็ก: ถ้ามี template → ❌ ห้ามใช้ AI
  // AI ใช้แค่อธิบายข้อมูล ไม่ใช่ตัดสินใจ

  // ✅ Human First Rule: ถาม preference ก่อนอธิบาย
  // กฎควบคุม: ถ้ายังไม่มี preference → หน้าที่ AI = ถามอย่างเดียว
  // ❌ ห้าม auto เข้า templateKnowledgeSurgery / templateExplainProcedure
  // จนกว่าจะได้คำตอบจากลูกค้า
  // 
  // 🔥 LOGIC LOCK: เบรก AI ไม่ให้หลุดกลับไปเป็น AI
  // ต่อให้ knowledge พร้อม → ก็ห้ามอธิบาย
  // ต้องผ่าน "ถามแบบคน" ก่อนเสมอ
  //
  // ✅ ลำดับที่ถูกต้อง (สำคัญมาก - ห้ามสลับ):
  // Step 1: เช็ก service + area ก่อน
  // Step 2: เช็ก preference (ถ้ายังไม่มี → ถามก่อน)
  // Step 3: เช็ก tone (ใน template functions เอง)
  // Step 4: เลือก template
  // ❌ ห้ามเช็ก "โหมด" ก่อน "preference" → AI จะหลุดไปอธิบาย
  
  // 🔹 ศัลยกรรม: ถาม preference ก่อน (ถ้ายังไม่มี)
  // 🟢 โหมด 1: แค่ทัก / สนใจ → ถามสั้น ๆ 1 คำถาม
  // ✅ แยกตามช่วงบทสนทนา: แชทใหม่ → ถามสั้น, คุยไปแล้ว → ค่อยละเอียด
  
  // ✅ Step 1: เช็ก service + area ก่อน
  // ✅ Step 2: เช็ก preference
  // ศัลยกรรมจมูก
  if (
    state.service === "surgery" &&
    state.area === "nose" &&
    !state.preference?.style &&
    state.intent !== "service_information" // 🔵 โหมด 3: ถามจริง → ให้ข้อมูลได้
  ) {
    // เพิ่งรู้ว่าเป็นจมูก แต่ยังไม่มี preference เลย (แชทใหม่)
    if (state.recentMessages.length <= 1) {
      return templateAskNosePreferenceHuman();
    }
    // คุยต่อแล้ว ค่อยถามละเอียด
    return templateAskNosePreference();
  }
  
  // ศัลยกรรมตา
  if (
    state.service === "surgery" &&
    state.area === "eye" &&
    !state.preference?.style &&
    state.intent !== "service_information"
  ) {
    if (state.recentMessages.length <= 1) {
      return templateAskEyePreferenceHuman();
    }
    return `ได้เลยค่ะ 😊  
ขอถามเพิ่มนิดนึงนะคะ สนใจตาสองชั้นแบบไหนคะ  
เช่น ชั้นเล็ก ธรรมชาติ หรือคมชัดคะ`;
  }
  
  // ศัลยกรรมอื่น ๆ (หน้าอก, ลำตัว, ฯลฯ)
  if (
    state.service === "surgery" &&
    state.area &&
    state.area !== "nose" &&
    state.area !== "eye" &&
    !state.preference?.goal &&
    state.intent !== "service_information"
  ) {
    return `ได้เลยค่ะ 😊  
ขอถามเพิ่มนิดนึงนะคะ ว่ามีจุดไหนที่กังวลเป็นพิเศษไหมคะ หรืออยากได้ผลลัพธ์แบบไหนคะ`;
  }
  
  // 🔑 SHORT REPLY LOCK (Response Length Guard)
  // ลูกค้าพิมพ์สั้น = บอทต้องตอบสั้น
  // ถ้าลูกค้าพิมพ์ไม่เกิน 1-3 คำ และมี preference.style แล้ว → ใช้ template สั้น ๆ
  if (
    state.service === "surgery" &&
    state.area === "nose" &&
    (state.preference?.style || /ธรรมชาติ|โด่ง|เกาหลี|สายฝอ/.test(userMessage.toLowerCase())) &&
    userMessage.trim().length <= 10 && // ไม่เกิน 10 ตัวอักษร (ประมาณ 1-3 คำ)
    state.intent !== "service_information"
  ) {
    return templateShortHumanFollowup(state, userMessage);
  }
  
  // 🔹 ศัลยกรรมจมูก: มี style แล้ว แต่ยังไม่รู้ intensity → ถามต่อ
  if (
    state.service === "surgery" &&
    state.area === "nose" &&
    state.preference?.style &&
    !state.preference?.intensity &&
    state.intent !== "service_information"
  ) {
    return templateNoseStyleFollowup(state);
  }
  
  // 🔹 ฟิลเลอร์/โบท็อกซ์: ถาม intensity, goal
  if (
    (state.service === "filler" || state.service === "botox") &&
    state.area &&
    !state.preference?.intensity &&
    !state.preference?.goal &&
    (state.stage === "service_selected" || state.stage === "pricing") &&
    state.intent !== "service_information"
  ) {
    return templateAskFillerBotoxPreference();
  }
  
  // 🔹 ทรีตเมนต์/เลเซอร์: ถาม concern, intensity, goal
  if (
    (state.service === "laser" || state.service === "skin" || state.service === "rejuran") &&
    !state.preference?.concern &&
    !state.preference?.intensity &&
    (state.stage === "service_selected" || state.stage === "pricing") &&
    state.intent !== "service_information"
  ) {
    return templateAskTreatmentPreference();
  }

  // 4️⃣ availability_check
  // 🔥 อันนี้ต้องจำให้ขึ้นใจ
  // ❌ templatePricing (ห้ามเด็ดขาด)
  // ❌ แสดงราคา
  // ✅ templateAvailability เท่านั้น
  if (state.intent === "availability_check") {
    return templateAvailability(state);
  }

  // price_inquiry — ถ้าไม่มี service → ใช้ exploring (ห้ามเดา)
  if (state.intent === "price_inquiry" && !state.service) {
    return templateExploring(state);
  }

  // refinement — ใช้ templateRefinement
  // (refinement จะถูกจับก่อนใน pipeline แล้ว แต่เพิ่ม guard ไว้เพื่อความปลอดภัย)
  if ((state.intent as string) === "refinement" || (state.service && state.area && /โด่ง|ธรรมชาติ|เกาหลี/.test(userMessage.toLowerCase()))) {
    return templateRefinement(state, userMessage);
  }

  // 2️⃣ service_information
  // กติกา: ถ้ามี service → อธิบาย service นั้น
  // ถ้าไม่มี service → แสดง option แบบกว้าง
  // ❌ ห้ามขาย
  // ❌ ห้ามพูดราคา
  if (state.intent === "service_information") {
    return templateServiceInformation(state);
  }

  // 🔧 comparison_inquiry — เปรียบเทียบบริการ
  // กติกา: เปรียบเทียบแบบเป็นกลาง ไม่ฟันธง ปิดด้วย "ขึ้นกับปัญหาผิว / แนะนำประเมิน"
  if (state.intent === "comparison_inquiry") {
    return templateComparison(state, userMessage);
  }

  // 🔧 hesitation — ความลังเล/กลัว
  // กติกา: รับอารมณ์ normalize ความกลัว ให้ข้อมูลสั้น ชวนคุยต่อ ไม่เร่งขาย
  if (state.intent === "hesitation") {
    return templateHesitation(state, userMessage);
  }

  // 3️⃣ promotion_inquiry / price_inquiry
  // ⚠️ Pricing/Promotion inquiry: ถ้ามี service → แสดงราคา/โปร
  // Guard: ถ้าไม่มี service → ใช้ exploring (ห้ามเดา)
  if (state.stage === "pricing" && state.service) {
    return templatePricing(state);
  }
  
  // ถ้า stage = pricing แต่ไม่มี service → exploring (ป้องกันหลุด other)
  if (state.stage === "pricing" && !state.service) {
    return templateExploring(state);
  }

  // 5️⃣ booking_request
  // กติกา: ถ้ายังไม่มี service → ถาม service
  // ถ้ามี service แต่ไม่มีวัน → ขอวัน
  // ถ้ามีครบ → confirm
  if (state.stage === "booking") {
    if (!state.service || !state.area) {
      return templateBookingNotReady(state);
    }
    // ถ้ามีครบแล้ว → ใช้ templatePricing หรือ templateAvailability ตาม context
    return templatePricing(state);
  }

  if (state.stage === "service_selected" && state.service) {
    // 🔧 FIX 2: Guard กัน template ผิด — ถ้า service + area ครบแล้ว → ใช้ templatePricing
    // ✅ ถ้า service + area ครบแล้ว → ใช้ templatePricing เสมอ
    // ❌ ห้ามใช้ templateServiceSelected ถ้ามี area แล้ว
    if (state.area && state.area !== "unknown") {
      // มีทั้ง service และ area แล้ว → ใช้ templatePricing
      return templatePricing({
        ...state,
        stage: "pricing",
      });
    }
    
    // 🧩 FIX 4: Guard กัน template ผิด — ถ้า service มี FIXED AREA → ใช้ templatePricing
    const fixedArea = hasFixedArea(state.service);
    if (fixedArea) {
      // มี FIXED AREA → ไม่ต้องถาม area → ใช้ templatePricing
      return templatePricing({
        ...state,
        area: fixedArea,
        stage: "pricing",
      });
    }
    return templateServiceSelected(state);
  }

  // ✅ FIX 3: Route template ตาม "หมวด service" ไม่ใช่ intent อย่างเดียว
  // ถ้าไม่มี service → route ตาม keyword ใน userMessage
  if (!state.service) {
    const lower = userMessage.toLowerCase();
    // ถ้ามี keyword ที่บ่งชี้ว่าเป็นศัลยกรรม → ใช้ templateExploringSurgery
    if (/จมูก|เสริมจมูก|ทำจมูก|แก้จมูก|ตาสองชั้น|คาง|กราม|ศัลยกรรม/.test(lower)) {
      return templateExploringSurgery(state);
    }
    // Default: ใช้ templateExploringSkin (หัตถการผิว)
    return templateExploringSkin(state);
  }
  
  // ถ้ามี service แล้ว → route ตาม service
  if (state.service === "surgery") {
    return templateExploringSurgery(state);
  }
  
  // exploring หรือยังไม่มี service (fallback)
  return templateExploring(state);
}
