export default function SLATabSkeleton() {
  return (
    <div>
      <div className="h-5 bg-gray-200 rounded w-80 mb-1 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
      <div className="h-12 bg-gray-200 rounded w-full mb-4 animate-pulse" />
      
      <div className="bg-surface border border-border rounded-lg mb-2">
        <div className="w-full flex items-center justify-between px-4 py-2.5 min-h-[44px]">
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-48 mb-1 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-40 animate-pulse" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-4 ml-4 animate-pulse" />
        </div>
        <div className="px-4 pb-3 border-t border-border pt-2.5">
          <div className="grid lg:grid-cols-12 gap-3 items-start mb-3">
            <div className="lg:col-span-9 min-w-0">
              <div className="h-48 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="lg:col-span-3 min-w-0 space-y-2">
              <div className="h-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-16 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg mb-2">
        <div className="w-full flex items-center justify-between px-4 py-2.5 min-h-[44px]">
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-56 mb-1 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-4 ml-4 animate-pulse" />
        </div>
        <div className="px-4 pb-3 border-t border-border pt-2.5">
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg mb-2">
        <div className="w-full flex items-center justify-between px-4 py-2.5 min-h-[44px]">
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-48 mb-1 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-40 animate-pulse" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-4 ml-4 animate-pulse" />
        </div>
        <div className="px-4 pb-3 border-t border-border pt-2.5">
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg mb-2">
        <div className="w-full flex items-center justify-between px-4 py-2.5 min-h-[44px]">
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-48 mb-1 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-4 ml-4 animate-pulse" />
        </div>
        <div className="px-4 pb-3 border-t border-border pt-2.5">
          <div className="overflow-x-auto max-h-[480px]">
            <div className="h-64 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg mb-2">
        <div className="w-full flex items-center justify-between px-4 py-2.5 min-h-[44px]">
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-56 mb-1 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-4 ml-4 animate-pulse" />
        </div>
        <div className="px-4 pb-3 border-t border-border pt-2.5">
          <div className="h-48 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
