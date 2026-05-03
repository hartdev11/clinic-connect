
from __future__ import annotations
from flask import Flask, request, jsonify
from datetime import datetime, timezone
from pathlib import Path
import re
import sys
from lead_intake_router import LeadIntakeRouter
from clinic_profile_manager import ClinicProfileManager
from sales_pipeline_engine import SalesPipelineEngine
from lead_scoring_engine import LeadScoringEngine
from offer_selector import OfferSelector
from booking_intent_engine import BookingIntentEngine
from booking_engine import BookingEngine
from handoff_engine import HandoffEngine
from affiliate_attribution_engine import AffiliateAttributionEngine
from customer_profile_store import CustomerProfileStore
from response_policy import evaluate_response_policy, build_regeneration_instructions
from prompt_v4 import build_prompt_package
from decision_engine import decide_response_plan
from hard_context_builder import build_hard_context
from anti_generic_guard import (
    evaluate_anti_generic_guard,
    build_anti_generic_regeneration_instruction,
)
from retrieval_telemetry_logger import (
    log_retrieval_telemetry,
    summarize_retrieval_telemetry,
)

# Reuse Firebase connection helper from phase_k.
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))
from phase_k.db_config import get_firestore_client  # type: ignore

app = Flask(__name__)

router = LeadIntakeRouter()
clinic_manager = ClinicProfileManager(config_dir=".")
pipeline_engine = SalesPipelineEngine()
scoring_engine = LeadScoringEngine()
offer_selector = OfferSelector()
booking_intent_engine = BookingIntentEngine()
booking_engine = BookingEngine()
handoff_engine = HandoffEngine()
attribution_engine = AffiliateAttributionEngine(default_commission_rate=0.10)
profile_store = CustomerProfileStore()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _safe_doc_id(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", value)


def _build_session_id(external_user_id: str, timestamp: str) -> str:
    day = (timestamp or _now_iso())[:10].replace("-", "")
    return f"line_{_safe_doc_id(external_user_id)}_{day}"


def _compose_ai_reply(offer_result, booking_intent_result, handoff_result) -> str:
    handoff = handoff_result.get("handoff") or {}
    if handoff.get("handoff_required"):
        target = handoff.get("handoff_target") or "เจ้าหน้าที่"
        return f"ขออนุญาตส่งต่อเคสนี้ให้ {target} ดูแลต่อให้นะครับ"
    lines = []
    if offer_result.selected_service_name:
        lines.append(f"แนะนำ: {offer_result.selected_service_name}")
    if offer_result.selected_base_price:
        lines.append(f"ราคาเริ่มต้น: {offer_result.selected_base_price} บาท")
    if offer_result.selected_promotion_text:
        lines.append(f"โปรโมชั่น: {offer_result.selected_promotion_text}")
    next_action = (booking_intent_result.get("booking_intent") or {}).get("next_action")
    if next_action == "confirm_booking_slot":
        lines.append("สามารถยืนยันวันและช่วงเวลาเพื่อจองคิวได้เลยครับ")
    elif next_action == "request_time_slot":
        lines.append("สะดวกวันและช่วงเวลาไหน แจ้งได้เลยครับ")
    elif next_action == "push_booking_confirmation":
        lines.append("หากต้องการจอง แจ้งได้เลยครับ")
    else:
        lines.append("หากสนใจข้อมูลเพิ่มเติม แจ้งได้เลยครับ")
    return "\n".join(lines) if lines else "ขอบคุณสำหรับข้อความครับ"


def _regenerate_reply_from_context(
    user_message: str,
    built_context: Dict[str, Any],
    intent: str,
    regen_instruction: str,
) -> str:
    """Template regeneration fallback for policy failures in Phase G runtime."""
    clinic_brands = [str(x).strip() for x in (built_context.get("clinic_brands") or []) if str(x).strip()]
    global_brands = [str(x).strip() for x in (built_context.get("global_brands") or []) if str(x).strip()]
    price_ranges = [str(x).strip() for x in (built_context.get("price_ranges") or []) if str(x).strip()]
    all_brands = clinic_brands + [x for x in global_brands if x not in clinic_brands]

    parts = []
    hard_context = built_context.get("hard_context") or {}
    allowed_brands = [str(x).strip() for x in (hard_context.get("allowed_brands") or []) if str(x).strip()]
    allowed_prices = [str(x).strip() for x in (hard_context.get("allowed_prices") or []) if str(x).strip()]
    decision_packet = built_context.get("decision_packet") or {}
    cta_hint = str(decision_packet.get("cta_message_hint") or "").strip()
    if allowed_brands:
        all_brands = allowed_brands
    if allowed_prices:
        price_ranges = allowed_prices
    if all_brands:
        parts.append("ตอนนี้มีแบรนด์ที่เกี่ยวข้อง เช่น " + ", ".join(all_brands) + " ครับ")
    if price_ranges:
        parts.append("ช่วงราคาในข้อมูลคือ " + ", ".join(price_ranges) + " ครับ")
    if not parts:
        parts.append("ขอบคุณสำหรับคำถามครับ เดี๋ยวแอดมินช่วยดูรายละเอียดให้แบบตรงเคสครับ")

    # Keep at most one follow-up question to satisfy policy.
    if intent in {"recommendation", "discovery"}:
        parts.append("อยากได้ลุคธรรมชาติหรือทรงชัดแบบไหนครับ?")

    if cta_hint:
        parts.append(cta_hint)
    regenerated = "\n".join(parts)
    if not regenerated.strip():
        regenerated = "ขอบคุณสำหรับข้อความครับ"
    return regenerated


def _persist_line_conversation(inbound_event, ai_reply_text):
    if str(inbound_event.get("source_platform", "")).strip().lower() != "line":
        return
    tenant_id = str(inbound_event.get("tenant_id", "")).strip()
    branch_id = str(inbound_event.get("branch_id", "")).strip() or None
    external_user_id = str(inbound_event.get("external_user_id", "")).strip()
    user_message = str(inbound_event.get("message_text", "")).strip()
    ts = str(inbound_event.get("timestamp", "")).strip() or _now_iso()
    if not tenant_id or not external_user_id or not user_message:
        return
    db = get_firestore_client()
    now = _now_iso()
    session_id = _build_session_id(external_user_id, ts)

    # Ensure customer exists for Customers & Chat page.
    customer_doc_id = f"line_{_safe_doc_id(tenant_id)}_{_safe_doc_id(external_user_id)}"
    customer_ref = db.collection("customers").document(customer_doc_id)
    if customer_ref.get().exists:
        customer_ref.set(
            {
                "org_id": tenant_id,
                "externalId": external_user_id,
                "source": "line",
                "platform": "line",
                "branch_id": branch_id,
                "status": "active",
                "lastChatAt": now,
                "updatedAt": now,
                "updated_at": now,
            },
            merge=True,
        )
    else:
        customer_ref.set(
            {
                "org_id": tenant_id,
                "externalId": external_user_id,
                "source": "line",
                "platform": "line",
                "branch_id": branch_id,
                "name": "ลูกค้า LINE",
                "status": "active",
                "createdAt": now,
                "updatedAt": now,
                "created_at": now,
                "updated_at": now,
                "lastChatAt": now,
                "aiResponded": True,
            }
        )

    # Persist conversation_feedback for thread rendering.
    db.collection("conversation_feedback").add(
        {
            "org_id": tenant_id,
            "user_id": external_user_id,
            "platform": "line",
            "branch_id": branch_id,
            "source": "line_oa",
            "session_id": session_id,
            "messages": [
                {"role": "user", "content": user_message, "timestamp": ts},
                {"role": "assistant", "content": ai_reply_text, "timestamp": now},
            ],
            "userMessage": user_message,
            "botReply": ai_reply_text,
            "createdAt": now,
            "updatedAt": now,
            "created_at": now,
            "updated_at": now,
        }
    )

@app.route("/inbound", methods=["POST"])
def inbound():
    try:
        inbound_event = request.json or {}
        required_fields = [
            "tenant_id",
            "clinic_id",
            "branch_id",
            "source_platform",
            "source_type",
            "external_user_id",
            "message_text",
            "timestamp",
        ]
        missing = [f for f in required_fields if not str(inbound_event.get(f, "")).strip()]
        if missing:
            return jsonify({"status": "error", "error": f"missing_required_fields:{','.join(missing)}"}), 400

        intake_result = router.route(inbound_event)
        profile = profile_store.upsert_from_intake(intake_result)
        history = profile_store.get_history_summary(profile.customer_id)

        clinic_context = clinic_manager.get_clinic_context(
            tenant_id=inbound_event["tenant_id"],
            clinic_id=inbound_event["clinic_id"],
            branch_id=inbound_event["branch_id"],
        )

        pipeline_result = pipeline_engine.upsert_pipeline(intake_result, clinic_context)

        score_result = scoring_engine.score(
            intake_result=intake_result,
            pipeline_result=pipeline_result,
            history=history,
        )

        profile_store.update_lead_score(profile.customer_id, score_result.score, score_result.level)

        offer_result = offer_selector.select_best_offer(
            intake_result=intake_result,
            pipeline_result=pipeline_result,
            score_result=score_result,
            clinic_context=clinic_context,
        )

        profile_store.append_recommendation(profile.customer_id, {
            "procedure_id": offer_result.selected_procedure_id,
            "promotion_id": offer_result.selected_promotion_id,
            "cta_strategy": offer_result.cta_strategy,
        })

        booking_intent_result = booking_intent_engine.evaluate(
            intake_result=intake_result,
            pipeline_result=pipeline_result,
            score_result=score_result,
            offer_result=offer_result,
        )

        handoff_result = handoff_engine.evaluate(
            intake_result=intake_result,
            pipeline_result=pipeline_result,
            booking_intent_result=booking_intent_result,
            customer_summary=history,
        )

        booking_result = None
        if booking_intent_result["booking_intent"]["next_action"] in ["confirm_booking_slot","push_booking_confirmation"] and not handoff_result["handoff"]["handoff_required"]:
            booking_result = booking_engine.create_booking(booking_intent_result=booking_intent_result, assigned_staff_id=None)
            if booking_result and booking_result.get("status") == "ok":
                profile_store.append_booking(profile.customer_id, booking_result["booking"])

        attribution_result = attribution_engine.attribute(
            intake_result=intake_result,
            booking_result=booking_result,
            attribution_model="last_touch",
            affiliate_rules={}
        )
        intent = str((intake_result.get("intent_result") or {}).get("intent") or "general")
        built_context = intake_result.get("built_context") or {}
        decision_packet = decide_response_plan(
            intent=intent,
            built_context=built_context,
            user_message=str(inbound_event.get("message_text") or ""),
        )
        built_context["decision_packet"] = decision_packet
        hard_context = build_hard_context(
            built_context=built_context,
            decision_packet=decision_packet,
        )
        built_context["hard_context"] = hard_context
        rendered_hard_context = str(hard_context.get("rendered_text") or "").strip()
        if rendered_hard_context:
            existing_blocks = [str(x).strip() for x in (built_context.get("final_context_blocks") or []) if str(x).strip()]
            built_context["final_context_blocks"] = [f"[HARD CONTEXT]\n{rendered_hard_context}"] + existing_blocks
        response_policy_cfg = {
            "answer_first": True,
            "no_generic_answer": True,
            "must_list_brands_if_available": True,
            "must_answer_price_if_available": True,
            "max_followup_questions": 1,
        }
        prompt_package = build_prompt_package(
            user_message=str(inbound_event.get("message_text") or ""),
            built_context=built_context,
            response_policy=response_policy_cfg,
        )

        # Current runtime still uses deterministic composer; prompt_package is prepared for LLM runtime.
        ai_reply_text = _compose_ai_reply(offer_result, booking_intent_result, handoff_result)

        policy_eval = evaluate_response_policy(
            user_message=str(inbound_event.get("message_text") or ""),
            response_text=ai_reply_text,
            built_context=built_context,
            intent=intent,
        )
        anti_generic_eval = evaluate_anti_generic_guard(
            user_message=str(inbound_event.get("message_text") or ""),
            response_text=ai_reply_text,
            hard_context=hard_context,
            decision_packet=decision_packet,
            intent=intent,
        )
        regen_instruction = None
        anti_generic_regen_instruction = None
        if (not policy_eval.get("passed")) or (not anti_generic_eval.get("passed")):
            regen_instruction = build_regeneration_instructions(
                evaluation=policy_eval,
                built_context=built_context,
                intent=intent,
            )
            anti_generic_regen_instruction = build_anti_generic_regeneration_instruction(
                guard_result=anti_generic_eval,
                hard_context=hard_context,
                decision_packet=decision_packet,
                intent=intent,
            )
            ai_reply_text = _regenerate_reply_from_context(
                user_message=str(inbound_event.get("message_text") or ""),
                built_context=built_context,
                intent=intent,
                regen_instruction="\n".join(
                    x for x in [str(regen_instruction or "").strip(), str(anti_generic_regen_instruction or "").strip()] if x
                ),
            )
            # Evaluate once again after regeneration for observability.
            policy_eval = evaluate_response_policy(
                user_message=str(inbound_event.get("message_text") or ""),
                response_text=ai_reply_text,
                built_context=built_context,
                intent=intent,
            )
            anti_generic_eval = evaluate_anti_generic_guard(
                user_message=str(inbound_event.get("message_text") or ""),
                response_text=ai_reply_text,
                hard_context=hard_context,
                decision_packet=decision_packet,
                intent=intent,
            )

        telemetry_record = log_retrieval_telemetry(
            query=str(inbound_event.get("message_text") or ""),
            intent=intent,
            pipeline=str((intake_result.get("brain_routing") or {}).get("pipeline") or "general_pipeline"),
            tenant_id=str(inbound_event.get("tenant_id") or ""),
            clinic_id=str(inbound_event.get("clinic_id") or "") or None,
            branch_id=str(inbound_event.get("branch_id") or "") or None,
            router_result=(intake_result.get("retrieval_router") or {}),
            response_policy_evaluation=policy_eval,
            metadata={
                "session_id": str((intake_result.get("session") or {}).get("session_id") or ""),
                "customer_id": str((intake_result.get("customer") or {}).get("customer_id") or ""),
                "lead_id": str((intake_result.get("lead") or {}).get("lead_id") or ""),
            },
        )

        _persist_line_conversation(inbound_event, ai_reply_text)

        return jsonify({
            "status": "ok",
            "lead": intake_result["lead"],
            "score": {"score": score_result.score, "level": score_result.level, "action": score_result.priority_action},
            "offer": {"procedure_id": offer_result.selected_procedure_id, "service_name": offer_result.selected_service_name, "price": offer_result.selected_base_price, "promotion": offer_result.selected_promotion_text, "cta": offer_result.cta_strategy},
            "booking_intent": booking_intent_result["booking_intent"],
            "handoff": handoff_result["handoff"],
            "booking": booking_result,
            "attribution": attribution_result["attribution"],
            "reply": ai_reply_text,
            "decision_packet": decision_packet,
            "hard_context": hard_context,
            "prompt_package": prompt_package,
            "response_policy": policy_eval,
            "anti_generic_guard": anti_generic_eval,
            "regeneration_instructions": regen_instruction,
            "anti_generic_regeneration_instructions": anti_generic_regen_instruction,
            "retrieval_telemetry": telemetry_record,
        })

    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/telemetry/retrieval/summary", methods=["GET"])
def retrieval_telemetry_summary():
    tenant_id = request.args.get("tenant_id")
    clinic_id = request.args.get("clinic_id")
    return jsonify(summarize_retrieval_telemetry(tenant_id=tenant_id, clinic_id=clinic_id))

if __name__ == "__main__":
    print("🚀 Sales Runtime API running on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
