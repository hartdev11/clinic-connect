export default function AgencyLoading() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-8 w-48 rounded bg-cream-200 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-24 rounded-2xl bg-cream-200 animate-pulse" />
        <div className="h-24 rounded-2xl bg-cream-200 animate-pulse" />
        <div className="h-24 rounded-2xl bg-cream-200 animate-pulse" />
        <div className="h-24 rounded-2xl bg-cream-200 animate-pulse" />
      </div>
      <div className="h-72 rounded-2xl bg-cream-200 animate-pulse" />
    </div>
  );
}
