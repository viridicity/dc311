interface ChartSkeletonProps {
  height?: number;
}

export default function ChartSkeleton({ height = 300 }: ChartSkeletonProps) {
  return (
    <div 
      className="bg-surface border border-border rounded-lg animate-pulse"
      style={{ height: `${height}px` }}
    >
      <div className="h-6 bg-gray-200 rounded w-48 m-4 mb-2" />
      <div className="h-full bg-gray-100 rounded mx-4 mb-4" />
    </div>
  );
}
