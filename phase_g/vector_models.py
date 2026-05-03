from __future__ import annotations

from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional


@dataclass
class VectorQueryRequest:
    tenant_id: str
    clinic_id: Optional[str]
    branch_id: Optional[str]
    query_text: str
    top_k: int
    language: str
    scope: str
    query_mode: str
    source_types: List[str]
    filters: Dict[str, Any] = field(default_factory=dict)
    min_score_threshold: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class VectorQueryResultItem:
    id: str
    text: str
    score: float
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class VectorQueryResponse:
    results: List[VectorQueryResultItem] = field(default_factory=list)
    debug: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "results": [x.to_dict() for x in self.results],
            "debug": self.debug,
        }


@dataclass
class VectorMetadata:
    tenant_id: Optional[str]
    clinic_id: Optional[str]
    branch_id: Optional[str]
    scope: str
    source_type: str
    document_id: str
    document_version: str
    chunk_index: int
    language: str
    is_active: bool = True
    procedure_code: Optional[str] = None
    offer_id: Optional[str] = None
    campaign_id: Optional[str] = None
    doctor_id: Optional[str] = None
    inventory_binding: bool = False
    pricing_binding: bool = False
    embedding_model: Optional[str] = None
    embedding_version: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class VectorRecord:
    id: str
    text: str
    embedding: List[float]
    metadata: VectorMetadata

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["metadata"] = self.metadata.to_dict()
        return payload


@dataclass
class IndexDocumentPayload:
    tenant_id: Optional[str]
    clinic_id: Optional[str]
    branch_id: Optional[str]
    scope: str
    source_type: str
    document_id: str
    document_version: str
    content: str
    language: str = "th"
    procedure_code: Optional[str] = None
    offer_id: Optional[str] = None
    campaign_id: Optional[str] = None
    doctor_id: Optional[str] = None
    inventory_binding: bool = False
    pricing_binding: bool = False
    extra_metadata: Dict[str, Any] = field(default_factory=dict)

    def validate(self) -> Dict[str, Any]:
        errors: List[str] = []
        if not str(self.scope or "").strip():
            errors.append("scope is required")
        if not str(self.source_type or "").strip():
            errors.append("source_type is required")
        if not str(self.document_id or "").strip():
            errors.append("document_id is required")
        if not str(self.document_version or "").strip():
            errors.append("document_version is required")
        if not str(self.content or "").strip():
            errors.append("content is required")
        return {"valid": len(errors) == 0, "errors": errors}

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class IndexingResult:
    action: str
    success: bool
    indexed_count: int = 0
    skipped_count: int = 0
    document_id: Optional[str] = None
    tenant_id: Optional[str] = None
    clinic_id: Optional[str] = None
    provider: str = "unknown"
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
