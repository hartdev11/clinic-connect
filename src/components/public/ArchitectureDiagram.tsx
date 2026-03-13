"use client";

/**
 * Enterprise: ไดอะแกรมแสดง flow ระบบ Clinic Connect
 * LINE → AI Pipeline (Intent, Safety, Escalation, Knowledge, Compose) → ตอบกลับ / Escalate
 */
export function ArchitectureDiagram() {
  return (
    <div
      className="w-full max-w-6xl mx-auto overflow-x-auto py-10 px-4 sm:px-6 min-w-0"
      aria-label="ไดอะแกรมสถาปัตยกรรมระบบ Clinic Connect"
      style={{ minHeight: 320 }}
    >
      <svg
        viewBox="0 0 1000 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto min-w-[800px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(15,23,42,0.04)"
              strokeWidth="0.5"
            />
          </pattern>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--teal-primary)" stopOpacity="0.3" />
            <stop offset="50%" stopColor="var(--teal-primary)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--teal-primary)" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="boxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--cream-50)" />
            <stop offset="100%" stopColor="var(--diagram-slate-100)" />
          </linearGradient>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--teal-primary)" />
          </marker>
          <marker
            id="arrowhead2"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--diagram-slate-400)" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* LINE / Customer */}
        <g>
          <rect
            x="40"
            y="120"
            width="120"
            height="120"
            rx="12"
            fill="url(#boxGrad)"
            stroke="var(--teal-primary)"
            strokeWidth="2"
          />
          <text x="100" y="175" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--diagram-slate-900)">
            LINE
          </text>
          <text x="100" y="200" textAnchor="middle" fontSize="11" fill="var(--diagram-slate-500)">
            ลูกค้าคลินิก
          </text>
          <text x="100" y="220" textAnchor="middle" fontSize="11" fill="var(--diagram-slate-400)">
            ถามคำถาม
          </text>
        </g>

        {/* Arrow 1 */}
        <path
          d="M 165 180 L 235 180"
          stroke="url(#lineGrad)"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />

        {/* Webhook / API */}
        <g>
          <rect
            x="240"
            y="140"
            width="100"
            height="80"
            rx="10"
            fill="var(--diagram-slate-50)"
            stroke="var(--diagram-slate-400)"
            strokeWidth="1.5"
          />
          <text x="290" y="175" textAnchor="middle" fontSize="12" fontWeight="500" fill="var(--diagram-slate-600)">
            Webhook
          </text>
          <text x="290" y="195" textAnchor="middle" fontSize="11" fill="var(--diagram-slate-400)">
            API
          </text>
        </g>

        {/* Arrow 2 */}
        <path d="M 345 180 L 395 180" stroke="var(--diagram-slate-300)" strokeWidth="2" markerEnd="url(#arrowhead2)" />

        {/* AI Pipeline box */}
        <rect
          x="400"
          y="60"
          width="400"
          height="240"
          rx="14"
          fill="rgba(12,122,111,0.06)"
          stroke="var(--teal-primary)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
        <text x="600" y="90" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--teal-primary)">
          AI Pipeline
        </text>

        {/* Pipeline steps */}
        {[
          { x: 430, label: "Intent", sub: "วิเคราะห์เจตนา" },
          { x: 515, label: "Safety", sub: "กรองเนื้อหา" },
          { x: 600, label: "Escalation", sub: "ส่งทีมเมื่อจำเป็น" },
          { x: 700, label: "Knowledge", sub: "ค้นข้อมูลคลินิก" },
          { x: 790, label: "Compose", sub: "สร้างคำตอบ" },
        ].map((s, i) => (
          <g key={s.label}>
            <rect
              x={s.x}
              y={110}
              width="70"
              height="60"
              rx="8"
              fill="var(--cream-50)"
              stroke="var(--teal-primary)"
              strokeWidth="1.5"
            />
            <text x={s.x + 35} y={135} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--diagram-slate-900)">
              {s.label}
            </text>
            <text x={s.x + 35} y={155} textAnchor="middle" fontSize="10" fill="var(--diagram-slate-500)">
              {s.sub}
            </text>
            {i < 4 && (
              <path
                d={`M ${s.x + 70} 140 L ${[430, 515, 600, 700, 790][i + 1]!} 140`}
                stroke="var(--teal-primary)"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
            )}
          </g>
        ))}

        {/* Arrow into pipeline */}
        <path d="M 395 180 L 430 170" stroke="var(--diagram-slate-400)" strokeWidth="2" markerEnd="url(#arrowhead2)" />

        {/* Knowledge Base (below pipeline) */}
        <g>
          <rect
            x="520"
            y="260"
            width="160"
            height="30"
            rx="6"
            fill="white"
            stroke="var(--teal-primary)"
            strokeWidth="1"
          />
          <text x="600" y="280" textAnchor="middle" fontSize="11" fill="var(--diagram-slate-600)">
            ข้อมูลคลินิก: บริการ · FAQ · โปรโมชัน
          </text>
          <path
            d="M 600 230 L 600 260"
            stroke="var(--diagram-slate-300)"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
        </g>

        {/* Arrow out to Response */}
        <path d="M 800 180 L 860 180" stroke="url(#lineGrad)" strokeWidth="2" markerEnd="url(#arrowhead)" />

        {/* Response / ทีม */}
        <g>
          <rect
            x="865"
            y="120"
            width="120"
            height="120"
            rx="12"
            fill="url(#boxGrad)"
            stroke="var(--teal-primary)"
            strokeWidth="2"
          />
          <text x="925" y="175" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--diagram-slate-900)">
            ตอบกลับ
          </text>
          <text x="925" y="200" textAnchor="middle" fontSize="11" fill="var(--diagram-slate-500)">
            LINE / Escalate
          </text>
          <text x="925" y="220" textAnchor="middle" fontSize="11" fill="var(--diagram-slate-400)">
            ส่งทีมเมื่อจำเป็น
          </text>
        </g>
      </svg>
      <p className="text-center text-xs text-slate-500 mt-4">
        Flow การทำงาน: ลูกค้าส่งข้อความผ่าน LINE → AI ประมวลผลด้วย Pipeline → ตอบจากข้อมูลคลินิก หรือส่งต่อทีม
      </p>
    </div>
  );
}
