export default function HomeFirstVisitSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-lg mb-2">
      <div className="px-4 py-2.5 border-b border-border">
        <div className="h-5 bg-gray-200 rounded w-64 animate-pulse" />
      </div>
      <div className="font-mono px-4 py-3">
        {/* Search input */}
        <div className="h-11 bg-gray-200 rounded-md w-full animate-pulse" />
        {/* Quick pick chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="h-8 bg-gray-200 rounded-full w-28 animate-pulse" />
          <div className="h-8 bg-gray-200 rounded-full w-36 animate-pulse" />
          <div className="h-8 bg-gray-200 rounded-full w-24 animate-pulse" />
          <div className="h-8 bg-gray-200 rounded-full w-32 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
