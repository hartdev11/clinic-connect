"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import {
  ROLE_MANAGER_AGENT,
  ANALYTICS_AGENTS_SPEC,
  type AIAgentSpec,
} from "@/lib/ai-agents";

function AgentCard({ agent }: { agent: AIAgentSpec }) {
  return (
    <Card key={agent.id} padding="lg" hover>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="font-semibold text-surface-800">{agent.name}</h3>
            <Badge variant={agent.enabled ? "success" : "default"}>
              {agent.enabled ? "On" : "Off"}
            </Badge>
            <Badge variant="info" className="text-xs">
              {agent.engine}
            </Badge>
            <Badge
              variant={agent.role === "role-manager" ? "success" : "warning"}
              className="text-xs"
            >
              {agent.role === "role-manager" ? "ตอบลูกค้า" : "วิเคราะห์ข้อมูล → ส่ง Role Manager"}
            </Badge>
          </div>
          <p className="text-sm text-surface-600">{agent.purpose}</p>
          <Button variant="ghost" size="sm" className="mt-2 text-primary-600">
            แก้ไข Prompt (Advanced)
          </Button>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input type="checkbox" defaultChecked={agent.enabled} className="sr-only peer" />
          <div className="w-11 h-6 bg-surface-200 rounded-full peer peer-checked:bg-primary-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:border-surface-300 after:rounded-full after:h-5 after:w-5 after:transition-all" />
          <span className="ms-3 text-sm font-medium text-surface-700">
            {agent.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
          </span>
        </label>
      </div>
    </Card>
  );
}

export default function AIAgentsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Agents"
        description="7 Agents: Role Manager 1 ตัว (ตอบลูกค้า) + Analytics 6 ตัว (วิเคราะห์ข้อมูลเว็บ → ส่งให้ Role Manager นำไปตอบลูกค้า)"
      />

      <section>
        <SectionHeader
          title="Role Manager — ตอบลูกค้า"
          description="ตัวเดียวที่รับแชทลูกค้า — ใช้ผลวิเคราะห์จาก 6 Agents เป็น context เพื่อตอบได้ตรงและครบถ้วน"
        />
        <AgentCard agent={ROLE_MANAGER_AGENT} />
      </section>

      <section>
        <SectionHeader
          title="6 Analytics Agents — วิเคราะห์ข้อมูลในเว็บ"
          description="แต่ละตัววิเคราะห์ข้อมูลส่วนต่าง ๆ → สรุปส่งให้ Role Manager นำไปใช้ตอบลูกค้า"
        />
        <div className="grid gap-4">
          {ANALYTICS_AGENTS_SPEC.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Activity Log" description="ประวัติการทำงานของ AI แต่ละ Agent" />
        <Card padding="lg">
          <div className="space-y-2">
            {[
              { time: "10:32", agent: "Role Manager", action: "นำผล Booking Analytics ไปตอบคุณ A — เสนอวันนัดว่าง" },
              { time: "10:31", agent: "Role Manager", action: "นำผล Knowledge Analytics ไปตอบคำถามราคาเลเซอร์" },
              { time: "10:30", agent: "Booking Analytics", action: "วิเคราะห์คิวว่างวันนี้ → ส่งสรุปให้ Role Manager" },
              { time: "10:28", agent: "Promotion Analytics", action: "วิเคราะห์โปรที่เหมาะกับลูกค้า → ส่งสรุปให้ Role Manager" },
            ].map((log, i) => (
              <div key={i} className="flex gap-4 py-3 border-b border-surface-100 last:border-0 text-sm">
                <span className="text-surface-400 w-12 font-mono text-xs">{log.time}</span>
                <span className="font-medium text-surface-700 w-40">{log.agent}</span>
                <span className="text-surface-600">{log.action}</span>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-4">
            ดูทั้งหมด →
          </Button>
        </Card>
      </section>
    </div>
  );
}
