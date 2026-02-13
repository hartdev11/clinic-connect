/**
 * LINE Messaging API — Helper
 * Get bot info, user profile (displayName, pictureUrl)
 */
const LINE_BOT_INFO_URL = "https://api.line.me/v2/bot/info";
const LINE_PROFILE_URL = "https://api.line.me/v2/bot/profile/";

export interface LineUserProfile {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LineBotInfo {
  userId: string;
  displayName?: string;
}

/**
 * เรียก LINE API GET /v2/bot/info เพื่อ validate token และดึง bot userId
 */
export async function getLineBotInfo(
  channelAccessToken: string
): Promise<LineBotInfo | null> {
  try {
    const res = await fetch(LINE_BOT_INFO_URL, {
      headers: {
        Authorization: `Bearer ${channelAccessToken.trim()}`,
      },
    });
    if (!res.ok) {
      const err = await res.text();
      if (process.env.NODE_ENV === "development") {
        console.warn("[LINE API] getBotInfo failed:", res.status, err.slice(0, 100));
      }
      return null;
    }
    const data = (await res.json()) as { userId?: string; displayName?: string };
    if (!data?.userId) return null;
    return {
      userId: data.userId,
      displayName: data.displayName,
    };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[LINE API] getBotInfo error:", (err as Error)?.message?.slice(0, 80));
    }
    return null;
  }
}

/** ดึง LINE user profile (displayName, pictureUrl) — ต้องมี channel access token */
export async function getLineUserProfile(
  channelAccessToken: string,
  userId: string
): Promise<LineUserProfile | null> {
  try {
    const res = await fetch(`${LINE_PROFILE_URL}${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${channelAccessToken.trim()}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      userId?: string;
      displayName?: string;
      pictureUrl?: string;
      statusMessage?: string;
    };
    if (!data?.userId) return null;
    return {
      userId: data.userId,
      displayName: data.displayName,
      pictureUrl: data.pictureUrl,
      statusMessage: data.statusMessage,
    };
  } catch {
    return null;
  }
}
