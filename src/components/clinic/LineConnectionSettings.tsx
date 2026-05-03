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
  org_id?: string;
}

type WebhookEvent =
  | "booking.created"
  | "booking.confirmed"
  | "booking.rejected"
  | "handoff.created"
  | "lead.hot";

interface WebhookConfigItem {
  id: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
}

const WEBHOOK_EVENT_OPTIONS: Array<{ value: WebhookEvent; label: string; desc: string }> = [
  { value: "booking.created", label: "booking.created", desc: "สร้างนัดใหม่แล้ว" },
  { value: "booking.confirmed", label: "booking.confirmed", desc: "ระบบส่งข้อความยืนยันนัดแล้ว" },
  { value: "booking.rejected", label: "booking.rejected", desc: "ระบบส่งข้อความปฏิเสธนัดแล้ว" },
  { value: "handoff.created", label: "handoff.created", desc: "มี handoff ใหม่" },
  { value: "lead.hot", label: "lead.hot", desc: "พบ hot lead" },
];

export function LineConnectionSettings() {
  const { data: status, mutate, error: fetchError } = useSWR<LineStatus>(
    "/api/clinic/line",
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
  const [copied, setCopied] = useState(false);
  const {
    data: webhookData,
    mutate: mutateWebhook,
    error: webhookFetchError,
  } = useSWR<{ items: WebhookConfigItem[] }>("/api/clinic/webhooks", apiFetcher, {
    revalidateOnFocus: false,
  });
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>(["booking.created"]);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookSuccess, setWebhookSuccess] = useState<string | null>(null);

  const webhookUrl =
    status?.org_id && typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/line/${status.org_id}`
      : status?.webhook_url ?? "";

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

  async function handleCreateWebhook() {
    setSavingWebhook(true);
    setWebhookError(null);
    setWebhookSuccess(null);
    try {
      const res = await fetch("/api/clinic/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: webhookUrlInput.trim(),
          events: webhookEvents,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWebhookError(json.error || "บันทึก Webhook ไม่สำเร็จ");
        return;
      }
      setWebhookSuccess(
        `เพิ่ม Webhook แล้ว${json.secret ? " (คัดลอก secret และเก็บไว้ทันที)" : ""}`
      );
      setWebhookUrlInput("");
      setWebhookEvents(["booking.created"]);
      mutateWebhook();
    } catch (err) {
      setWebhookError((err as Error)?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleDeleteWebhook(id: string) {
    setDeletingWebhookId(id);
    setWebhookError(null);
    setWebhookSuccess(null);
    try {
      const res = await fetch(`/api/clinic/webhooks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWebhookError(json.error || "ลบ Webhook ไม่สำเร็จ");
        return;
      }
      setWebhookSuccess("ลบ Webhook แล้ว");
      mutateWebhook();
    } catch (err) {
      setWebhookError((err as Error)?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setDeletingWebhookId(null);
    }
  }

  const webhookItems = webhookData?.items ?? [];

  return (
    <RequireRole allowed={["owner", "manager"]}>
      <section className="space-y-6">
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
          <div className={`mb-6 p-4 rounded-xl border ${status?.connected ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
            <p className={`text-sm font-medium mb-2 ${status?.connected ? "text-green-800" : "text-amber-800"}`}>
              {status?.connected ? "✓ Connected" : "Not connected"}
              {status?.bot_display_name ? ` — ${status.bot_display_name}` : ""}
            </p>
            <p className={`text-xs mb-2 ${status?.connected ? "text-green-700" : "text-amber-700"}`}>
              Webhook URL ที่ต้องตั้งใน LINE Developers:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className={`block flex-1 min-w-0 sm:min-w-[260px] p-2 rounded text-xs overflow-x-auto break-all ${status?.connected ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"}`}>
                {webhookUrl || "กำลังโหลด..."}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={async () => {
                  if (!webhookUrl) return;
                  await navigator.clipboard.writeText(webhookUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                disabled={!webhookUrl}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

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
              <strong>{webhookUrl || "URL ด้านบน"}</strong> → Verify
            </p>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader
            title="Partner Webhook (Booking/Handoff/Lead)"
            subtitle="ตั้งค่า endpoint สำหรับรับ event จากระบบ เช่น booking.confirmed / booking.rejected"
          />
          <div className="space-y-4">
            <div className="rounded-xl border border-cream-200 bg-cream-50 p-4 text-xs text-mauve-700 space-y-2">
              <p className="font-medium text-mauve-800">คำแนะนำสำคัญ</p>
              <p>- ถ้าต้องการรองรับแจ้งเตือนช่องทาง Facebook/Instagram/TikTok/Web ให้เพิ่ม event `booking.confirmed` และ `booking.rejected`</p>
              <p>- ระบบเซ็น HMAC ใน header `X-Clinic-Signature` โดยใช้ secret ของ webhook config</p>
              <p>- URL ปลายทางต้องเป็น HTTPS และพร้อมตอบ 2xx ภายในเวลาที่เหมาะสม</p>
            </div>

            {webhookFetchError && (
              <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">{webhookFetchError.message}</p>
            )}

            <div className="overflow-x-auto border border-cream-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-cream-50 border-b border-cream-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-mauve-700">Endpoint</th>
                    <th className="text-left px-3 py-2 font-medium text-mauve-700">Events</th>
                    <th className="text-left px-3 py-2 font-medium text-mauve-700">สถานะ</th>
                    <th className="text-right px-3 py-2 font-medium text-mauve-700">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookItems.map((item) => (
                    <tr key={item.id} className="border-b border-cream-100 last:border-b-0">
                      <td className="px-3 py-2">
                        <code className="text-xs text-mauve-700 break-all">{item.url}</code>
                      </td>
                      <td className="px-3 py-2 text-xs text-mauve-600">{item.events.join(", ")}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={item.isActive ? "text-green-700" : "text-mauve-500"}>
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingWebhookId === item.id}
                          onClick={() => handleDeleteWebhook(item.id)}
                        >
                          {deletingWebhookId === item.id ? "กำลังลบ..." : "ลบ"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {webhookItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-mauve-500">
                        ยังไม่มี partner webhook config
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 max-w-2xl">
              <Input
                label="Webhook Endpoint URL (HTTPS)"
                placeholder="https://example.com/clinic-webhook"
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
              />
              <div>
                <p className="text-sm font-medium text-mauve-700 mb-2">Events ที่ต้องการรับ</p>
                <div className="space-y-2">
                  {WEBHOOK_EVENT_OPTIONS.map((opt) => {
                    const checked = webhookEvents.includes(opt.value);
                    return (
                      <label key={opt.value} className="flex items-start gap-2 text-sm text-mauve-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setWebhookEvents((prev) =>
                              e.target.checked
                                ? Array.from(new Set([...prev, opt.value]))
                                : prev.filter((v) => v !== opt.value)
                            );
                          }}
                        />
                        <span>
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-mauve-500"> — {opt.desc}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {webhookError && (
                <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{webhookError}</p>
              )}
              {webhookSuccess && (
                <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{webhookSuccess}</p>
              )}
              <div>
                <Button
                  onClick={handleCreateWebhook}
                  disabled={savingWebhook || !webhookUrlInput.trim() || webhookEvents.length === 0}
                >
                  {savingWebhook ? "กำลังบันทึก..." : "เพิ่ม Webhook"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </RequireRole>
  );
}
