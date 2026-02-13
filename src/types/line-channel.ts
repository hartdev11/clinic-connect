/**
 * LINE Channel — Multi-tenant
 * แต่ละ org มี LINE Channel ของตัวเอง เก็บ credentials ใน Firestore
 */

export interface LineChannel {
  org_id: string;
  channel_id: string;
  channel_secret: string;
  channel_access_token: string;
  /** Bot User ID (destination ใน webhook) — ใช้สำหรับ routing */
  bot_user_id: string;
  /** ชื่อบอทจาก LINE API */
  bot_display_name?: string;
  /** Webhook URL ที่ต้องตั้งใน LINE Developers */
  webhook_url: string;
  created_at: string;
  updated_at: string;
}

export interface LineChannelCreate {
  org_id: string;
  channel_id: string;
  channel_secret: string;
  channel_access_token: string;
}

/** ผลลัพธ์ที่ไม่ expose secret/token */
export interface LineChannelStatus {
  connected: boolean;
  bot_display_name?: string;
  webhook_url: string;
  bot_user_id?: string;
}
