export default function EstimateTabSkeleton() {
  return (
    <div>
      <div className="bg-surface border border-border rounded-lg">
        <div className="px-4 py-2.5 min-h-[44px] border-b border-border">
          <div className="h-5 bg-gray-200 rounded w-48 animate-pulse" />
        </div>
        <div className="p-4">
          <div className="h-10 bg-gray-200 rounded w-full animate-pulse mb-3" />
          <div className="h-8 bg-gray-200 rounded w-full animate-pulse" />
          <div className="mt-3 space-y-2">
            <div className="h-8 bg-gray-200 rounded w-3/4 animate-pulse" />
            <div className="h-8 bg-gray-200 rounded w-1/2 animate-pulse" />
            <div className="h-8 bg-gray-200 rounded w-2/3 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="mt-3 bg-surface border border-border rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-3" />
        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}
