import SectionCardSkeleton from '../shared/SectionCardSkeleton';

export default function ExplorerTabSkeleton() {
  return (
    <div>
      <div className="h-5 bg-gray-200 rounded w-96 mb-3 animate-pulse" />
      <div className="h-12 bg-gray-200 rounded w-full mb-4 animate-pulse" />
      
      <SectionCardSkeleton />
      
      <div className="bg-surface border border-border rounded-lg mb-2">
        <div className="w-full flex items-center justify-between px-4 py-2.5 min-h-[44px]">
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-64 mb-1 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-4 ml-4 animate-pulse" />
        </div>
        <div className="px-4 pb-3 border-t border-border pt-2.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="h-64 bg-gray-200 rounded animate-pulse" />
            <div className="space-y-3">
              <div className="h-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-48 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg mb-2">
        <div className="w-full flex items-center justify-between px-4 py-2.5 min-h-[44px]">
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-56 mb-1 animate-pulse" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="h-64 bg-gray-200 rounded animate-pulse" />
            <div className="h-64 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      <SectionCardSkeleton />
    </div>
  );
}
