
from __future__ import annotations
import hashlib
import uuid
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional
from source_taxonomy import LeadStage, validate_canonical_inbound_event_shape
from intent_classifier import classify_intent
from brain_router import route_intent
from context_builder import build_context, render_prompt_context
from retrieval_service import RetrievalService, build_runtime_search_params
from embedding_service import EmbeddingService
from vector_store_interface import InMemoryVectorStore, InMemoryVectorRecord
from retrieval_router import create_retrieval_router

@dataclass
class CustomerRecord:
    customer_id: str
    tenant_id: str
    clinic_id: str
    branch_id: str
    external_user_id: str
    source_platform: str
    first_source_type: str

@dataclass
class LeadRecord:
    lead_id: str
    tenant_id: str
    clinic_id: str
    branch_id: str
    customer_id: str
    source_platform: str
    source_type: str
    lead_stage: str
    lead_score: int
    session_id: str
    campaign_id: Optional[str]
    affiliate_id: Optional[str]

@dataclass
class IntakeSessionRecord:
    session_id: str
    tenant_id: str
    clinic_id: str
    branch_id: str
    customer_id: str
    lead_id: str
    source_platform: str
    source_type: str

class InMemoryLeadStore:
    def __init__(self):
        self.customers_by_key: Dict[str, CustomerRecord] = {}
        self.leads_by_key: Dict[str, LeadRecord] = {}
        self.sessions_by_key: Dict[str, IntakeSessionRecord] = {}

    @staticmethod
    def build_customer_key(tenant_id, clinic_id, external_user_id, source_platform):
        raw = f"{tenant_id}|{clinic_id}|{source_platform}|{external_user_id}"
        return hashlib.sha256(raw.encode()).hexdigest()

    @staticmethod
    def build_lead_key(tenant_id, clinic_id, customer_id, source_platform):
        raw = f"{tenant_id}|{clinic_id}|{customer_id}|{source_platform}"
        return hashlib.sha256(raw.encode()).hexdigest()

    @staticmethod
    def build_session_key(tenant_id, clinic_id, customer_id, source_platform, source_type):
        raw = f"{tenant_id}|{clinic_id}|{customer_id}|{source_platform}|{source_type}"
        return hashlib.sha256(raw.encode()).hexdigest()

class LeadIntakeRouter:
    def __init__(self, store=None):
        self.store = store or InMemoryLeadStore()
        self.embedding_service = EmbeddingService()
        self.vector_store = InMemoryVectorStore()
        self.retrieval_service = RetrievalService(
            embedding_service=self.embedding_service,
            vector_store=self.vector_store,
        )
        self.retrieval_router = create_retrieval_router(self.retrieval_service, mode="chroma_only")

    def route(self, canonical_event: Dict[str, Any]) -> Dict[str, Any]:
        errors = validate_canonical_inbound_event_shape(canonical_event)
        if errors:
            raise ValueError(f"invalid_canonical_event:{errors}")
        intent_result = classify_intent(canonical_event.get("message_text", ""))
        brain_routing = route_intent(str(intent_result.get("intent") or "general"))

        # Retrieval service wiring:
        # 1) if caller already passes retrieval_results, keep it
        # 2) else run retrieval_service with in-memory vector records (if provided) as fallback
        retrieval_results = canonical_event.get("retrieval_results") or []
        retrieval_runtime = None
        retrieval_router_result = None
        if not retrieval_results:
            vector_records_payload = canonical_event.get("vector_records") or []
            records = []
            for idx, x in enumerate(vector_records_payload):
                if not isinstance(x, dict):
                    continue
                text = str(x.get("text") or "").strip()
                if not text:
                    continue
                emb = x.get("embedding")
                if isinstance(emb, list) and emb:
                    embedding = [float(v) for v in emb]
                else:
                    embedding = self.embedding_service.embed_text(text).embedding
                records.append(
                    InMemoryVectorRecord(
                        id=str(x.get("id") or f"rec_{idx}"),
                        text=text,
                        embedding=embedding,
                        metadata=dict(x.get("metadata") or {}),
                    )
                )
            self.vector_store = InMemoryVectorStore(records=records)
            self.retrieval_service = RetrievalService(
                embedding_service=self.embedding_service,
                vector_store=self.vector_store,
            )
            self.retrieval_router = create_retrieval_router(self.retrieval_service, mode="chroma_only")
            retrieval_router_result = self.retrieval_router.route(
                user_message=str(canonical_event.get("message_text") or ""),
                tenant_id=str(canonical_event.get("tenant_id") or ""),
                clinic_id=str(canonical_event.get("clinic_id") or "") or None,
                branch_id=str(canonical_event.get("branch_id") or "") or None,
                intent=str(intent_result.get("intent") or "general"),
                pipeline=str(brain_routing.get("pipeline") or "general_pipeline"),
            )
            retrieval_runtime = retrieval_router_result.results if retrieval_router_result else None
            retrieval_results = (retrieval_runtime or {}).get("merged_results") or []

        similar_examples = canonical_event.get("similar_examples") or []
        built_context = build_context(
            intent=str(intent_result.get("intent") or "general"),
            routing_result=brain_routing,
            retrieval_results=retrieval_results,
            similar_conversations=similar_examples,
        )
        prompt_context_text = render_prompt_context(built_context)
        customer = self._resolve_customer(canonical_event)
        lead = self._resolve_lead(canonical_event, customer, intent_result, brain_routing)
        session = self._resolve_session(canonical_event, customer, lead)
        return {
            "canonical_event": canonical_event,
            "intent_result": intent_result,
            "brain_routing": brain_routing,
            "retrieval_router": retrieval_router_result.to_dict() if retrieval_router_result else None,
            "retrieval_result": retrieval_runtime,
            "built_context": built_context,
            "prompt_context_text": prompt_context_text,
            "customer": asdict(customer),
            "lead": asdict(lead),
            "session": asdict(session),
            "routing_status": "ok",
        }

    def _resolve_customer(self, event):
        key = self.store.build_customer_key(event["tenant_id"], event["clinic_id"], event["external_user_id"], event["source_platform"])
        existing = self.store.customers_by_key.get(key)
        if existing:
            return existing
        customer = CustomerRecord(
            customer_id=f"cust_{uuid.uuid4().hex[:10]}",
            tenant_id=event["tenant_id"], clinic_id=event["clinic_id"],
            branch_id=event["branch_id"], external_user_id=event["external_user_id"],
            source_platform=event["source_platform"], first_source_type=event["source_type"]
        )
        self.store.customers_by_key[key] = customer
        return customer

    def _resolve_lead(self, event, customer, intent_result: Dict[str, Any], brain_routing: Dict[str, Any]):
        key = self.store.build_lead_key(event["tenant_id"], event["clinic_id"], customer.customer_id, event["source_platform"])
        existing = self.store.leads_by_key.get(key)
        if existing:
            return existing
        session_id = f"sess_{uuid.uuid4().hex[:10]}"
        text = (event.get("message_text") or "").lower()
        intent = str(intent_result.get("intent") or "general")
        confidence = float(intent_result.get("confidence") or 0.1)

        pipeline = str(brain_routing.get("pipeline") or "general_pipeline")

        if pipeline == "booking_pipeline" or intent == "booking":
            stage = LeadStage.BOOKING_INTENT.value
        elif pipeline in {"product_pipeline", "promotion_pipeline", "comparison_pipeline"}:
            stage = LeadStage.PRICING_SENT.value
        else:
            stage = LeadStage.ENGAGED.value

        # Keep legacy keyword signal; blend with explicit intent confidence.
        keyword_score = (
            40
            + sum(20 for k in ["ราคา", "กี่บาท", "จอง", "นัด", "โปร"] if k in text)
            + sum(10 for k in ["ดีไหม", "ช่วยอะไร", "อันไหนดี"] if k in text)
        )
        score = min(100, int(max(keyword_score, 30 + confidence * 70)))
        lead = LeadRecord(
            lead_id=f"lead_{uuid.uuid4().hex[:10]}", tenant_id=event["tenant_id"],
            clinic_id=event["clinic_id"], branch_id=event["branch_id"],
            customer_id=customer.customer_id, source_platform=event["source_platform"],
            source_type=event["source_type"], lead_stage=stage, lead_score=min(score,100),
            session_id=session_id, campaign_id=event.get("campaign_id"), affiliate_id=event.get("affiliate_id")
        )
        self.store.leads_by_key[key] = lead
        return lead

    def _resolve_session(self, event, customer, lead):
        key = self.store.build_session_key(event["tenant_id"], event["clinic_id"], customer.customer_id, event["source_platform"], event["source_type"])
        existing = self.store.sessions_by_key.get(key)
        if existing:
            return existing
        session = IntakeSessionRecord(
            session_id=lead.session_id, tenant_id=event["tenant_id"],
            clinic_id=event["clinic_id"], branch_id=event["branch_id"],
            customer_id=customer.customer_id, lead_id=lead.lead_id,
            source_platform=event["source_platform"], source_type=event["source_type"]
        )
        self.store.sessions_by_key[key] = session
        return session
