interface PageHeaderProps {
  title: string;
  description: string;
  /** เล็กน้อย แสดง badge "AI วิเคราะห์ข้อมูลจากส่วนนี้" */
  aiAnalyze?: boolean;
}

export function PageHeader({
  title,
  description,
  aiAnalyze = false,
}: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-800 tracking-tight">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-surface-600 max-w-2xl leading-relaxed">
            {description}
          </p>
        </div>
        {aiAnalyze && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium border border-primary-100/80">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
            AI วิเคราะห์ข้อมูลจากส่วนนี้
          </span>
        )}
      </div>
    </header>
  );
}
