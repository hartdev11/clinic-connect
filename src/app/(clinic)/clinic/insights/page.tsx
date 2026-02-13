import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";

export default function InsightsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Insights & Reports"
        description="AI-Driven — คำถามยอดนิยม บริการยอดนิยม Peak Chat Time • AI Recommendation"
        aiAnalyze
      />

      <section>
        <SectionHeader
          title="คำถามและบริการยอดนิยม"
          description="Top questions จากลูกค้า • Popular services"
        />
        <div className="grid md:grid-cols-2 gap-6">
          <Card padding="lg">
            <CardHeader title="คำถามยอดนิยม" subtitle="Top questions จากลูกค้า" />
            <ul className="space-y-3">
              {["ราคาเลเซอร์กำจัดขนเท่าไหร่", "จองคิวได้วันไหนบ้าง", "มีโปรโมชั่นไหม"].map((q, i) => (
                <li key={i} className="flex items-center gap-3 text-surface-700 text-sm">
                  <span className="w-6 h-6 rounded-full bg-surface-100 flex items-center justify-center text-xs font-medium text-surface-500 flex-shrink-0">{i + 1}</span>
                  {q}
                </li>
              ))}
            </ul>
          </Card>
          <Card padding="lg">
            <CardHeader title="บริการยอดนิยม" subtitle="Popular services" />
            <ul className="space-y-3">
              {[
                { name: "เลเซอร์กำจัดขน", count: 45 },
                { name: "ฟิลเลอร์", count: 32 },
                { name: "โบท็อกซ์", count: 28 },
              ].map((s, i) => (
                <li key={i} className="flex justify-between text-surface-700 py-2 border-b border-surface-100 last:border-0 text-sm">
                  <span>{s.name}</span>
                  <span className="font-semibold text-surface-900">{s.count} ครั้ง</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section>
        <SectionHeader
          title="Peak Chat Time"
          description="ช่วงเวลาที่มีแชทมากที่สุด — Phase 2 จะมี Chart"
        />
        <Card padding="lg">
          <CardHeader title="Peak Chat Time" subtitle="ช่วงเวลาที่มีแชทมากที่สุด" />
          <div className="h-40 bg-surface-50 rounded-xl flex items-center justify-center border border-surface-100">
            <div className="text-center text-surface-400 text-sm">
              <p className="text-3xl mb-2">📊</p>
              <p className="font-medium">Chart.js / Recharts (Phase 2)</p>
              <p className="text-xs mt-1">10:00-12:00, 14:00-16:00 — Peak</p>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeader title="AI Recommendation" description="สิ่งที่ควรทำต่อ" />
        <Card padding="lg">
          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-primary-50 border border-primary-200/40">
              <p className="font-semibold text-primary-900 text-sm">แนะนำ: สร้างโปรโมชั่นสำหรับเลเซอร์กำจัดขน</p>
              <p className="text-sm text-primary-700 mt-1">บริการนี้มียอดสอบถามสูง 45% — พิจารณาแพ็กเกจพิเศษ</p>
            </div>
            <div className="p-5 rounded-xl bg-amber-50 border border-amber-200/40">
              <p className="font-semibold text-amber-900 text-sm">เตือน: ช่วง 14:00-16:00 แชทรอตอบสูง</p>
              <p className="text-sm text-amber-700 mt-1">พิจารณาเพิ่ม staff หรือปรับ AI response time</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
