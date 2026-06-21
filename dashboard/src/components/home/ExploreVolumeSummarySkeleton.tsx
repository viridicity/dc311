export default function ExploreVolumeSummarySkeleton() {
  return (
    <section className="article-section article-prose">
      <h2 className="article-headline text-gray-400">The weight of half a million requests</h2>
      <p className="article-dek text-gray-400">
        <span className="inline-block h-4 bg-gray-200 rounded w-48 animate-pulse" />
      </p>

      {/* Map placeholder — mirrors HomeRequestFlowMap */}
      <div className="w-full h-48 sm:h-64 bg-gray-200 rounded-lg animate-pulse mb-4" />

      {/* Chart grid — mirrors ArticleFigure layout: 8-col throughput + 4-col pie */}
      <div className="grid lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 min-w-0">
          <div className="h-[360px] bg-gray-200 rounded animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-3/4 mt-2 animate-pulse" />
        </div>
        <div className="lg:col-span-4 min-w-0">
          <div className="h-[360px] bg-gray-200 rounded animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-1/2 mt-2 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
