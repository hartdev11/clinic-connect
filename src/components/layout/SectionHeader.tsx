interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-surface-800">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-surface-500 max-w-xl">{description}</p>
      )}
    </div>
  );
}
