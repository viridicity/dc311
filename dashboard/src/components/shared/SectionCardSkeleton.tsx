export default function SectionCardSkeleton() {
  return (
    <section className="bg-surface border border-border rounded-lg mb-2 animate-pulse">
      <div className="w-full flex items-center justify-between px-4 py-2.5 min-h-[44px]">
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-48 mb-1 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-4 ml-4 animate-pulse" />
      </div>
      <div className="px-4 pb-3 border-t border-border pt-2.5">
        <div className="h-20 bg-gray-200 rounded animate-pulse" />
      </div>
    </section>
  );
}
