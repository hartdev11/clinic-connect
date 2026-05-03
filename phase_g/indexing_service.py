from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

from chunking_service import ChunkingService
from embedding_service import EmbeddingService
from vector_models import (
    IndexDocumentPayload,
    IndexingResult,
    VectorMetadata,
    VectorRecord,
)
from vector_store_interface import VectorStoreInterface


GLOBAL_TENANT_ID = "global"
GLOBAL_SCOPE = "global"
CLINIC_SCOPE = "clinic"


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_text_lower(value: Any) -> str:
    return _normalize_text(value).lower()


def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _merge_extra_metadata(base: Dict[str, Any], extra: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    merged = dict(base)
    if isinstance(extra, dict):
        merged.update(extra)
    return merged


class VectorSourceRepositoryInterface:
    def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def list_clinic_documents(
        self,
        tenant_id: str,
        clinic_id: str,
        branch_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def list_global_documents(self, source_types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        raise NotImplementedError


@dataclass
class IndexingExecutionResult:
    success: bool
    action: str
    document_id: Optional[str]
    tenant_id: Optional[str]
    clinic_id: Optional[str]
    indexed_chunks: int
    deleted_chunks: int
    errors: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class IndexingService:
    def __init__(
        self,
        chunking_service: ChunkingService,
        embedding_service: EmbeddingService,
        vector_store: VectorStoreInterface,
        source_repository: Optional[VectorSourceRepositoryInterface] = None,
    ) -> None:
        self.chunking_service = chunking_service
        self.embedding_service = embedding_service
        self.vector_store = vector_store
        self.source_repository = source_repository

    def index_document(self, payload: IndexDocumentPayload) -> IndexingResult:
        validation = payload.validate()
        if not validation["valid"]:
            return IndexingResult(
                action="index_document",
                success=False,
                indexed_count=0,
                skipped_count=0,
                document_id=payload.document_id,
                tenant_id=payload.tenant_id,
                clinic_id=payload.clinic_id,
                provider=self.vector_store.provider_name(),
                errors=validation["errors"],
            )

        normalized_scope = _normalize_text_lower(payload.scope)
        normalized_source_type = _normalize_text_lower(payload.source_type)

        if normalized_scope == GLOBAL_SCOPE:
            payload.tenant_id = GLOBAL_TENANT_ID
            payload.clinic_id = None
            payload.branch_id = None

        if normalized_scope == CLINIC_SCOPE and not payload.tenant_id:
            return IndexingResult(
                action="index_document",
                success=False,
                provider=self.vector_store.provider_name(),
                errors=["clinic-scope document requires tenant_id"],
                document_id=payload.document_id,
                tenant_id=payload.tenant_id,
                clinic_id=payload.clinic_id,
            )
        if normalized_scope == CLINIC_SCOPE and not payload.clinic_id:
            return IndexingResult(
                action="index_document",
                success=False,
                provider=self.vector_store.provider_name(),
                errors=["clinic-scope document requires clinic_id"],
                document_id=payload.document_id,
                tenant_id=payload.tenant_id,
                clinic_id=payload.clinic_id,
            )

        chunk_items = self.chunking_service.chunk_document(
            content=payload.content,
            section_title=payload.extra_metadata.get("section_title") if payload.extra_metadata else None,
        )
        if not chunk_items:
            return IndexingResult(
                action="index_document",
                success=False,
                provider=self.vector_store.provider_name(),
                errors=["chunking returned no chunks"],
                document_id=payload.document_id,
                tenant_id=payload.tenant_id,
                clinic_id=payload.clinic_id,
            )

        chunk_texts = [c.text for c in chunk_items]
        embedding_result = self.embedding_service.embed_batch(chunk_texts)
        if not embedding_result.success:
            return IndexingResult(
                action="index_document",
                success=False,
                indexed_count=0,
                skipped_count=len(chunk_items),
                document_id=payload.document_id,
                tenant_id=payload.tenant_id,
                clinic_id=payload.clinic_id,
                provider=self.vector_store.provider_name(),
                errors=embedding_result.errors,
            )

        if len(embedding_result.vectors) != len(chunk_items):
            return IndexingResult(
                action="index_document",
                success=False,
                indexed_count=0,
                skipped_count=len(chunk_items),
                document_id=payload.document_id,
                tenant_id=payload.tenant_id,
                clinic_id=payload.clinic_id,
                provider=self.vector_store.provider_name(),
                errors=["embedding count mismatch with chunk count"],
            )

        records: List[VectorRecord] = []
        for idx, chunk_item in enumerate(chunk_items):
            emb = embedding_result.vectors[idx]
            metadata = VectorMetadata(
                tenant_id=payload.tenant_id,
                clinic_id=payload.clinic_id,
                branch_id=payload.branch_id,
                scope=normalized_scope,
                source_type=normalized_source_type,
                document_id=payload.document_id,
                document_version=payload.document_version,
                chunk_index=chunk_item.chunk_index,
                language=payload.language,
                is_active=True,
                procedure_code=payload.procedure_code,
                offer_id=payload.offer_id,
                campaign_id=payload.campaign_id,
                doctor_id=payload.doctor_id,
                inventory_binding=payload.inventory_binding,
                pricing_binding=payload.pricing_binding,
                embedding_model=emb.model,
                embedding_version=emb.embedding_version,
                extra=_merge_extra_metadata(
                    {
                        "section_title": chunk_item.section_title,
                        "chunk_strategy": chunk_item.strategy,
                        "chunk_char_count": chunk_item.char_count,
                    },
                    payload.extra_metadata,
                ),
            )
            records.append(
                VectorRecord(
                    id=self._build_record_id(
                        document_id=payload.document_id,
                        chunk_index=chunk_item.chunk_index,
                        scope=normalized_scope,
                        tenant_id=payload.tenant_id,
                        clinic_id=payload.clinic_id,
                    ),
                    text=chunk_item.text,
                    embedding=emb.embedding,
                    metadata=metadata,
                )
            )

        result = self.vector_store.upsert_records(records)
        result.action = "index_document"
        result.document_id = payload.document_id
        result.tenant_id = payload.tenant_id
        result.clinic_id = payload.clinic_id
        return result

    def reindex_document(self, document_id: str) -> IndexingResult:
        if not self.source_repository:
            return IndexingResult(
                action="reindex_document",
                success=False,
                provider=self.vector_store.provider_name(),
                errors=["source_repository is required for reindex_document"],
            )
        source_doc = self.source_repository.get_document(document_id)
        if not source_doc:
            return IndexingResult(
                action="reindex_document",
                success=False,
                document_id=document_id,
                provider=self.vector_store.provider_name(),
                errors=["document not found in source repository"],
            )
        payload = self._payload_from_source_doc(source_doc)
        payload_validation = payload.validate()
        if not payload_validation["valid"]:
            return IndexingResult(
                action="reindex_document",
                success=False,
                document_id=payload.document_id,
                tenant_id=payload.tenant_id,
                clinic_id=payload.clinic_id,
                provider=self.vector_store.provider_name(),
                errors=payload_validation["errors"],
            )
        delete_result = self.vector_store.delete_by_document(
            document_id=payload.document_id,
            tenant_id=payload.tenant_id,
            clinic_id=payload.clinic_id,
            branch_id=payload.branch_id,
        )
        if not delete_result.success:
            delete_result.action = "reindex_document"
            return delete_result
        index_result = self.index_document(payload)
        index_result.action = "reindex_document"
        return index_result

    def reindex_clinic(self, tenant_id: str, clinic_id: str, branch_id: Optional[str] = None) -> IndexingResult:
        if not self.source_repository:
            return IndexingResult(
                action="reindex_clinic",
                success=False,
                tenant_id=tenant_id,
                clinic_id=clinic_id,
                provider=self.vector_store.provider_name(),
                errors=["source_repository is required for reindex_clinic"],
            )
        docs = self.source_repository.list_clinic_documents(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id)
        if not docs:
            return IndexingResult(
                action="reindex_clinic",
                success=True,
                indexed_count=0,
                skipped_count=0,
                tenant_id=tenant_id,
                clinic_id=clinic_id,
                provider=self.vector_store.provider_name(),
            )

        total_indexed = 0
        total_skipped = 0
        errors: List[str] = []
        for doc in docs:
            payload = self._payload_from_source_doc(doc)
            delete_result = self.vector_store.delete_by_document(
                document_id=payload.document_id,
                tenant_id=payload.tenant_id,
                clinic_id=payload.clinic_id,
                branch_id=payload.branch_id,
            )
            if not delete_result.success:
                total_skipped += 1
                errors.extend(delete_result.errors)
                continue
            index_result = self.index_document(payload)
            if index_result.success:
                total_indexed += index_result.indexed_count
            else:
                total_skipped += 1
                errors.extend(index_result.errors)
        return IndexingResult(
            action="reindex_clinic",
            success=len(errors) == 0,
            indexed_count=total_indexed,
            skipped_count=total_skipped,
            tenant_id=tenant_id,
            clinic_id=clinic_id,
            provider=self.vector_store.provider_name(),
            errors=errors,
        )

    def reindex_global_documents(self, source_types: Optional[List[str]] = None) -> IndexingResult:
        if not self.source_repository:
            return IndexingResult(
                action="reindex_global",
                success=False,
                tenant_id=GLOBAL_TENANT_ID,
                clinic_id=None,
                provider=self.vector_store.provider_name(),
                errors=["source_repository is required for reindex_global_documents"],
            )
        docs = self.source_repository.list_global_documents(source_types=source_types)
        if not docs:
            return IndexingResult(
                action="reindex_global",
                success=True,
                indexed_count=0,
                skipped_count=0,
                tenant_id=GLOBAL_TENANT_ID,
                clinic_id=None,
                provider=self.vector_store.provider_name(),
            )
        total_indexed = 0
        total_skipped = 0
        errors: List[str] = []
        for doc in docs:
            payload = self._payload_from_source_doc(doc)
            delete_result = self.vector_store.delete_by_document(
                document_id=payload.document_id,
                tenant_id=payload.tenant_id,
                clinic_id=payload.clinic_id,
                branch_id=payload.branch_id,
            )
            if not delete_result.success:
                total_skipped += 1
                errors.extend(delete_result.errors)
                continue
            index_result = self.index_document(payload)
            if index_result.success:
                total_indexed += index_result.indexed_count
            else:
                total_skipped += 1
                errors.extend(index_result.errors)
        return IndexingResult(
            action="reindex_global",
            success=len(errors) == 0,
            indexed_count=total_indexed,
            skipped_count=total_skipped,
            tenant_id=GLOBAL_TENANT_ID,
            clinic_id=None,
            provider=self.vector_store.provider_name(),
            errors=errors,
        )

    def delete_document_vectors(
        self,
        document_id: str,
        tenant_id: str,
        clinic_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> IndexingResult:
        result = self.vector_store.delete_by_document(
            document_id=document_id,
            tenant_id=tenant_id,
            clinic_id=clinic_id,
            branch_id=branch_id,
        )
        result.action = "delete_document"
        return result

    def deactivate_document_vectors(
        self,
        document_id: str,
        tenant_id: str,
        clinic_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> IndexingResult:
        result = self.vector_store.delete_by_document(
            document_id=document_id,
            tenant_id=tenant_id,
            clinic_id=clinic_id,
            branch_id=branch_id,
        )
        result.action = "deactivate_document"
        return result

    def _payload_from_source_doc(self, source_doc: Dict[str, Any]) -> IndexDocumentPayload:
        source_doc = _safe_dict(source_doc)
        scope = _normalize_text_lower(source_doc.get("scope"))
        tenant_id = _normalize_text(source_doc.get("tenant_id"))
        clinic_id = _normalize_text(source_doc.get("clinic_id")) or None
        branch_id = _normalize_text(source_doc.get("branch_id")) or None
        if scope == GLOBAL_SCOPE:
            tenant_id = GLOBAL_TENANT_ID
            clinic_id = None
            branch_id = None
        return IndexDocumentPayload(
            tenant_id=tenant_id,
            clinic_id=clinic_id,
            branch_id=branch_id,
            scope=scope or GLOBAL_SCOPE,
            source_type=_normalize_text_lower(source_doc.get("source_type")),
            document_id=_normalize_text(source_doc.get("document_id")),
            document_version=_normalize_text(source_doc.get("document_version")) or "v1",
            content=_normalize_text(source_doc.get("content")),
            language=_normalize_text_lower(source_doc.get("language")) or "th",
            procedure_code=_normalize_text_lower(source_doc.get("procedure_code")) or None,
            offer_id=_normalize_text(source_doc.get("offer_id")) or None,
            campaign_id=_normalize_text(source_doc.get("campaign_id")) or None,
            doctor_id=_normalize_text(source_doc.get("doctor_id")) or None,
            inventory_binding=bool(source_doc.get("inventory_binding", False)),
            pricing_binding=bool(source_doc.get("pricing_binding", False)),
            extra_metadata=_safe_dict(source_doc.get("extra_metadata")),
        )

    def _build_record_id(
        self,
        document_id: str,
        chunk_index: int,
        scope: str,
        tenant_id: Optional[str],
        clinic_id: Optional[str],
    ) -> str:
        return f"{scope}::{tenant_id or 'none'}::{clinic_id or 'none'}::{document_id}::{chunk_index}"


class InMemoryVectorSourceRepository(VectorSourceRepositoryInterface):
    def __init__(self, documents: Optional[List[Dict[str, Any]]] = None) -> None:
        self.documents = _safe_list(documents)

    def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        for doc in self.documents:
            if _normalize_text(doc.get("document_id")) == _normalize_text(document_id):
                return doc
        return None

    def list_clinic_documents(
        self,
        tenant_id: str,
        clinic_id: str,
        branch_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for doc in self.documents:
            if _normalize_text_lower(doc.get("scope")) != CLINIC_SCOPE:
                continue
            if _normalize_text(doc.get("tenant_id")) != _normalize_text(tenant_id):
                continue
            if _normalize_text(doc.get("clinic_id")) != _normalize_text(clinic_id):
                continue
            if branch_id and _normalize_text(doc.get("branch_id")) != _normalize_text(branch_id):
                continue
            results.append(doc)
        return results

    def list_global_documents(self, source_types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        normalized_types = [_normalize_text_lower(x) for x in (source_types or []) if _normalize_text(x)]
        results: List[Dict[str, Any]] = []
        for doc in self.documents:
            if _normalize_text_lower(doc.get("scope")) != GLOBAL_SCOPE:
                continue
            if normalized_types and _normalize_text_lower(doc.get("source_type")) not in normalized_types:
                continue
            results.append(doc)
        return results


def validate_indexing_service(service: IndexingService) -> Dict[str, Any]:
    errors: List[str] = []
    if not isinstance(service.chunking_service, ChunkingService):
        errors.append("chunking_service must be ChunkingService")
    if not isinstance(service.embedding_service, EmbeddingService):
        errors.append("embedding_service must be EmbeddingService")
    if not isinstance(service.vector_store, VectorStoreInterface):
        errors.append("vector_store must implement VectorStoreInterface")
    return {"valid": len(errors) == 0, "errors": errors}
