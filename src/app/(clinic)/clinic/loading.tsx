export default function ClinicLoading() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-8 w-56 rounded bg-cream-200 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-28 rounded-2xl bg-cream-200 animate-pulse" />
        <div className="h-28 rounded-2xl bg-cream-200 animate-pulse" />
        <div className="h-28 rounded-2xl bg-cream-200 animate-pulse" />
      </div>
      <div className="h-80 rounded-2xl bg-cream-200 animate-pulse" />
    </div>
  );
}
