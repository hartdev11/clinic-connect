interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-4 pl-3 border-l-2 border-primary-300/70">
      <h2 className="text-base font-semibold text-surface-800">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-primary-700/80 max-w-xl">{description}</p>
      )}
    </div>
  );
}
