"use client";

/**
 * LINE Connection — Multi-tenant
 * คลินิกกรอก Channel Secret + Channel Access Token → ระบบ validate และเก็บใน Firestore
 */
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { RequireRole } from "@/components/rbac/RequireRole";
import useSWR from "swr";
import { apiFetcher } from "@/lib/api-fetcher";

interface LineStatus {
  connected: boolean;
  bot_display_name?: string;
  webhook_url: string;
  bot_user_id?: string;
}

interface DebugOrg {
  sessionOrgId: string | null;
  lineOrgId: string | null;
  match: boolean;
  lineOrgIdSet: boolean;
}

export function LineConnectionSettings() {
  const { data: status, mutate, error: fetchError } = useSWR<LineStatus>(
    "/api/clinic/line",
    apiFetcher,
    { revalidateOnFocus: false }
  );
  const { data: debugOrg } = useSWR<DebugOrg>(
    "/api/clinic/debug-org",
    apiFetcher,
    { revalidateOnFocus: false }
  );

  const [channelSecret, setChannelSecret] = useState("");
  const [channelToken, setChannelToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/clinic/line", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          channel_secret: channelSecret.trim(),
          channel_access_token: channelToken.trim(),
          channel_id: channelId.trim() || "default",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setSuccess(true);
      setChannelSecret("");
      setChannelToken("");
      setChannelId("");
      mutate();
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError((err as Error)?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireRole allowed={["owner", "manager"]}>
      <section>
        <SectionHeader
          title="LINE Connection"
          description="เชื่อมต่อ LINE Official Account เพื่อให้ AI ตอบแชทลูกค้าอัตโนมัติ"
        />
        <Card padding="lg">
          <CardHeader
            title="LINE Bot"
            subtitle={
              status?.connected
                ? `เชื่อมต่อแล้ว — ${status.bot_display_name || "Bot"}`
                : "ยังไม่ได้เชื่อมต่อ"
            }
          />

          {fetchError && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mb-4">
              {fetchError.message}
            </p>
          )}
          {debugOrg && (
            <div
              className={`mb-6 p-4 rounded-xl border ${
                debugOrg.match ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
              }`}
            >
              {debugOrg.match ? (
                <p className="text-sm font-medium text-green-800">
                  ✓ LINE_ORG_ID ตรงกับ org ของคุณ — ลูกค้า LINE จะแสดงใน Customers & Chat
                </p>
              ) : !debugOrg.lineOrgIdSet ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800">
                    LINE_ORG_ID ยังไม่ได้ตั้งค่า — ลูกค้า/แชทจาก LINE จะไม่แสดงในหน้า Customers & Chat
                  </p>
                  {debugOrg.sessionOrgId && (
                    <p className="text-xs text-amber-700">
                      ตั้งค่าใน .env.local: <code className="bg-amber-100 px-1 rounded">LINE_ORG_ID={debugOrg.sessionOrgId}</code>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800">
                    LINE_ORG_ID ไม่ตรงกับ org ของคุณ — ลูกค้า/แชทจาก LINE จึงไม่แสดง
                  </p>
                  {debugOrg.sessionOrgId && (
                    <p className="text-xs text-amber-700">
                      แก้ไขใน .env.local ให้ตรงกับ org ของคุณ:{" "}
                      <code className="bg-amber-100 px-1 rounded">LINE_ORG_ID={debugOrg.sessionOrgId}</code>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {status?.connected && (
            <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200">
              <p className="text-sm font-medium text-green-800 mb-2">
                ✓ เชื่อมต่อแล้ว
                {status.bot_display_name && ` — ${status.bot_display_name}`}
              </p>
              <p className="text-xs text-green-700 mb-2">
                Webhook URL ที่ตั้งใน LINE Developers:
              </p>
              <code className="block p-2 rounded bg-green-100 text-green-900 text-xs overflow-x-auto">
                {status.webhook_url}
              </code>
            </div>
          )}

          <div className="space-y-4 max-w-xl">
            <p className="text-sm text-surface-600">
              ดึงค่าจาก{" "}
              <a
                href="https://developers.line.biz/console/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
              >
                LINE Developers Console
              </a>{" "}
              → เลือก Channel → Basic settings / Messaging API
            </p>

            <Input
              label="Channel Secret"
              type={showSecrets ? "text" : "password"}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
              value={channelSecret}
              onChange={(e) => setChannelSecret(e.target.value)}
            />
            <Input
              label="Channel Access Token"
              type={showSecrets ? "text" : "password"}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
              value={channelToken}
              onChange={(e) => setChannelToken(e.target.value)}
            />
            <Input
              label="Channel ID (ไม่บังคับ)"
              placeholder="default"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            />

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSecrets}
                  onChange={(e) => setShowSecrets(e.target.checked)}
                />
                แสดงค่าที่กรอก
              </label>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                ✓ บันทึกสำเร็จ — ตั้ง Webhook URL ใน LINE Developers แล้วทดสอบส่งข้อความ
              </p>
            )}

            <Button
              onClick={handleConnect}
              disabled={loading || !channelSecret.trim() || !channelToken.trim()}
            >
              {loading ? "กำลังตรวจสอบ..." : status?.connected ? "อัปเดต" : "เชื่อมต่อ LINE"}
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-surface-100">
            <p className="text-xs text-surface-500">
              หลังบันทึก: ไปที่ LINE Developers → Messaging API → Webhook URL → ใส่{" "}
              <strong>{status?.webhook_url || "URL ด้านบน"}</strong> → Verify
            </p>
          </div>
        </Card>
      </section>
    </RequireRole>
  );
}
