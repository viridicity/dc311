export default function RawDataTabSkeleton() {
  return (
    <div>
      <p className="prose-paragraph mb-3">
        <span className="inline-block h-4 bg-gray-200 rounded w-96 animate-pulse" />
      </p>

      {/* Filter bar - matches ExplorerFilterBar grid layout */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
            <div className="h-8 bg-gray-200 rounded w-full animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
            <div className="h-8 bg-gray-200 rounded w-full animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
            <div className="h-8 bg-gray-200 rounded w-full animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-14 animate-pulse" />
            <div className="h-8 bg-gray-200 rounded w-full animate-pulse" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 border border-border">
        <div className="h-6 bg-gray-200 rounded w-48 mb-3 animate-pulse" />

        {/* Table header row */}
        <div className="h-10 bg-gray-100 rounded mb-2 animate-pulse" />
        
        {/* Table rows */}
        <div className="space-y-1">
          <div className="h-9 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
