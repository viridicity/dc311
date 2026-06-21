const MONTH_COUNT = 12;

export default function SlaComplianceSummarySkeleton() {
  return (
    <section className="article-section article-prose">
      <h2 className="article-headline text-gray-400">The service level agreement</h2>
      <p className="article-dek">
        <span className="inline-block h-4 bg-gray-200 rounded w-80 animate-pulse" />
      </p>

      <div className="font-mono">
        <div className="mb-3">
          <p className="text-xl sm:text-2xl font-bold leading-snug mb-0 font-mono text-gray-300">
            <span className="text-7xl sm:text-8xl tabular-nums tracking-tight leading-none">
              —
            </span>
            {' '}met SLA.
          </p>
        </div>

        {/* Timeline bars — mirrors MonthlySlaTimeline layout */}
        <div className="flex gap-1 sm:gap-1.5 items-stretch h-10 sm:h-12">
          {Array.from({ length: MONTH_COUNT }).map((_, i) => (
            <div key={i} className="flex-1 rounded-sm bg-gray-200 animate-pulse" />
          ))}
        </div>

        {/* Date range labels */}
        <div className="flex justify-between mt-1.5">
          <div className="h-3 bg-gray-200 rounded w-10 animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-10 animate-pulse" />
        </div>

        {/* Legend row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
          <div className="h-3 bg-gray-200 rounded w-36 animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-24 animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-32 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
