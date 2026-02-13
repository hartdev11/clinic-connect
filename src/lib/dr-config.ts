/**
 * Enterprise Disaster Recovery Configuration
 * RPO/RTO, Pinecone failover, Firestore backup strategy
 */

/** RPO: Max acceptable data loss window (hours) */
export const RPO_HOURS = 24;

/** RTO: Max acceptable recovery time (hours) */
export const RTO_HOURS = 4;

/** Firestore: Scheduled export frequency (daily recommended for SOC2) */
export const FIRESTORE_BACKUP_SCHEDULE = "0 2 * * *"; // 02:00 UTC daily

/** Firestore: Retention for exported backups (days) */
export const FIRESTORE_BACKUP_RETENTION_DAYS = 90;

/** Pinecone: Primary host (default) */
export const PINECONE_PRIMARY_HOST = process.env.PINECONE_HOST ?? "https://api.pinecone.io";

/** Pinecone: Failover host — use when primary region unreachable */
export const PINECONE_FAILOVER_HOST = process.env.PINECONE_FAILOVER_HOST ?? "";

/** Pinecone: Index backup frequency (weekly for knowledge vectors) */
export const PINECONE_BACKUP_FREQUENCY_DAYS = 7;

/** Cross-region: Firestore is multi-region by default (us-central1, etc.) */
export const FIRESTORE_MULTI_REGION_ENABLED = true;

export interface DRConfig {
  rpo_hours: number;
  rto_hours: number;
  firestore_backup_schedule: string;
  firestore_backup_retention_days: number;
  pinecone_failover_available: boolean;
  pinecone_primary_host: string;
  pinecone_failover_host: string;
}

export function getDRConfig(): DRConfig {
  return {
    rpo_hours: RPO_HOURS,
    rto_hours: RTO_HOURS,
    firestore_backup_schedule: FIRESTORE_BACKUP_SCHEDULE,
    firestore_backup_retention_days: FIRESTORE_BACKUP_RETENTION_DAYS,
    pinecone_failover_available: !!PINECONE_FAILOVER_HOST,
    pinecone_primary_host: PINECONE_PRIMARY_HOST,
    pinecone_failover_host: PINECONE_FAILOVER_HOST,
  };
}
