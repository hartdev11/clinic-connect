from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

from context_builder import render_prompt_context


SYSTEM_PROMPT_V4 = """คุณคือแอดมินขายเก่งของคลินิกความงามระดับพรีเมียมในไทย
หน้าที่ของคุณคือช่วยตอบลูกค้าให้ตรงคำถาม ใช้ข้อมูลจริงของคลินิก และพาไปสู่การจองอย่างเป็นธรรมชาติ

กฎหลัก:
1. ต้องตอบคำถามลูกค้าให้ตรงก่อน ห้ามเลี่ยง
2. ต้องใช้ข้อมูลจาก CONTEXT / KNOWLEDGE / DATABASE ที่ระบบส่งมาเท่านั้น
3. ถ้าไม่มีข้อมูลจริง ห้ามเดา ห้าม hallucinate ให้ตอบตามตรงอย่างสุภาพ
4. ถ้ามีข้อมูลจริง เช่น brand / ราคา / รุ่น / ความต่าง ต้องตอบให้ชัด
5. หลังตอบคำถามแล้ว ค่อยถามต่อได้ 1 คำถาม
6. ห้ามตอบ generic เช่น “มีหลายแบบค่ะ” หรือ “มีหลายแบรนด์ค่ะ” ถ้ามีข้อมูลจริงอยู่แล้ว
7. ใช้ clinic-specific knowledge ก่อน global knowledge เสมอ
8. โทนต้องธรรมชาติ สุภาพ อบอุ่น ขายเก่งแบบไม่ hard sell
9. ใช้ภาษาไทยแบบแชต อ่านง่าย ไม่แข็ง ไม่วิชาการเกินไป
10. ถ้าลูกค้าถามเรื่องยี่ห้อ ราคา รุ่น โปรโมชั่น ความแตกต่าง หรือแบบไหนเหมาะ ต้องตอบจากข้อมูลจริงก่อน แล้วค่อยแนะนำต่อ

รูปแบบการตอบที่ต้องยึด:
- ตอบคำถามตรงก่อน
- อธิบายสั้น ๆ ถ้าจำเป็น
- ถ้ามีหลายทางเลือก ให้สรุปแบบเข้าใจง่าย
- ปิดท้ายด้วยคำถามต่อ 1 คำถามเพื่อพา conversation ไปข้างหน้า

สิ่งที่ห้ามทำ:
- ห้ามถามกลับก่อนตอบคำถามหลัก
- ห้ามใช้คำตอบกว้าง ๆ ถ้ามีข้อมูลจริง
- ห้ามพูดเหมือน chatbot ทั่วไป
- ห้ามให้ข้อมูลที่ไม่มีใน context
"""


DEVELOPER_RULE_TEMPLATE = """You must prioritize product clarity, truthful clinic-specific answering, and conversion.

Mandatory rules:
- answer the user's question directly first
- use clinic-specific facts first
- use global facts only to supplement
- do not answer vaguely if context contains concrete facts
- do not hallucinate unavailable clinic-specific details
- ask at most one follow-up question after answering
- do not produce a generic filler answer

Current intent: {intent}
Current pipeline: {pipeline}
Current response_mode: {response_mode}
"""


INTENT_RULES: Dict[str, str] = {
    "brand_inquiry": """For brand questions:
- explicitly list available brands if context contains them
- do not say "มีหลายแบรนด์" without naming them
- if brands differ in style/use, summarize briefly
- after answering, ask one short question about desired lip style or goal""",
    "pricing": """For pricing questions:
- state the price or price range if available
- briefly explain what affects price
- do not avoid the question
- after answering, ask one short question to estimate the most suitable option""",
    "recommendation": """For recommendation questions:
- recommend based on available facts only
- explain the recommendation briefly
- if more information is needed, ask only one clarifying follow-up after giving an initial recommendation""",
    "discovery": """For discovery questions:
- acknowledge the user's interest
- propose relevant options from context
- keep the tone consultative and friendly
- move the conversation forward naturally""",
    "comparison": """For comparison questions:
- compare the options using facts from context
- summarize the difference in plain Thai
- avoid overexplaining
- end with one practical suggestion""",
    "objection": """For objections:
- answer the concern directly
- reassure only with facts available in context
- keep the tone calm and confident
- then guide the user to the next step gently""",
    "booking": """For booking questions:
- answer about booking or schedule directly
- if exact availability is not in context, say you can help check
- keep the answer concise
- ask one follow-up question only if needed to finalize the booking""",
}


@dataclass
class PromptPackage:
    system_prompt: str
    developer_prompt: str
    context_text: str
    user_prompt: str
    final_prompt_text: str
    intent: str
    pipeline: str
    response_mode: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def validate(self) -> Dict[str, Any]:
        errors: List[str] = []
        if not self.system_prompt:
            errors.append("system_prompt is required")
        if not self.developer_prompt:
            errors.append("developer_prompt is required")
        if not self.context_text:
            errors.append("context_text is required")
        if not self.user_prompt:
            errors.append("user_prompt is required")
        if not self.final_prompt_text:
            errors.append("final_prompt_text is required")
        if not self.intent:
            errors.append("intent is required")
        if not self.pipeline:
            errors.append("pipeline is required")
        if not self.response_mode:
            errors.append("response_mode is required")
        return {"valid": len(errors) == 0, "errors": errors}


class PromptV4Builder:
    def build_prompt_package(
        self,
        user_message: str,
        built_context: Dict[str, Any],
        response_policy: Optional[Dict[str, Any]] = None,
        extra_instructions: Optional[List[str]] = None,
    ) -> PromptPackage:
        built_context = built_context or {}
        response_policy = response_policy or {}

        intent = str(built_context.get("intent", "general")).strip().lower()
        pipeline = str(built_context.get("pipeline", "general_pipeline")).strip()
        response_mode = str(built_context.get("response_mode", "general_helpful")).strip()
        context_text = render_prompt_context(built_context)

        developer_parts: List[str] = [
            DEVELOPER_RULE_TEMPLATE.format(
                intent=intent,
                pipeline=pipeline,
                response_mode=response_mode,
            )
        ]
        intent_specific_rule = INTENT_RULES.get(intent)
        if intent_specific_rule:
            developer_parts.append(intent_specific_rule)
        if response_policy:
            developer_parts.append(self._render_policy_block(response_policy))
        if extra_instructions:
            cleaned = [str(x).strip() for x in extra_instructions if str(x).strip()]
            if cleaned:
                developer_parts.append("[EXTRA INSTRUCTIONS]\n" + "\n".join(f"- {x}" for x in cleaned))

        developer_prompt = "\n\n".join(developer_parts)
        user_prompt = f"[USER MESSAGE]\n{user_message.strip()}"
        final_prompt_text = "\n\n".join([
            "[SYSTEM PROMPT]",
            SYSTEM_PROMPT_V4,
            "[DEVELOPER PROMPT]",
            developer_prompt,
            "[CONTEXT]",
            context_text,
            user_prompt,
        ])

        return PromptPackage(
            system_prompt=SYSTEM_PROMPT_V4,
            developer_prompt=developer_prompt,
            context_text=context_text,
            user_prompt=user_prompt,
            final_prompt_text=final_prompt_text,
            intent=intent,
            pipeline=pipeline,
            response_mode=response_mode,
        )

    def _render_policy_block(self, response_policy: Dict[str, Any]) -> str:
        answer_first = response_policy.get("answer_first", True)
        no_generic_answer = response_policy.get("no_generic_answer", True)
        must_list_brands = response_policy.get("must_list_brands_if_available", True)
        must_answer_price = response_policy.get("must_answer_price_if_available", True)
        max_followup = response_policy.get("max_followup_questions", 1)
        return (
            "[RESPONSE POLICY]\n"
            f"- answer_first = {answer_first}\n"
            f"- no_generic_answer = {no_generic_answer}\n"
            f"- must_list_brands_if_available = {must_list_brands}\n"
            f"- must_answer_price_if_available = {must_answer_price}\n"
            f"- max_followup_questions = {max_followup}"
        )


_builder = PromptV4Builder()


def build_prompt_package(
    user_message: str,
    built_context: Dict[str, Any],
    response_policy: Optional[Dict[str, Any]] = None,
    extra_instructions: Optional[List[str]] = None,
) -> Dict[str, Any]:
    result = _builder.build_prompt_package(
        user_message=user_message,
        built_context=built_context,
        response_policy=response_policy,
        extra_instructions=extra_instructions,
    )
    return result.to_dict()
