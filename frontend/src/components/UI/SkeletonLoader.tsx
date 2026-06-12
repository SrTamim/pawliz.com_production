export function SkeletonCard({ count = 1 }: any) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg p-4 mb-4">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-3" />
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-3" />
          <div className="h-20 bg-gray-300 dark:bg-gray-600 rounded w-full" />
        </div>
      ))}
    </>
  );
}

export function SkeletonImage({ width = "full", height = "h-40" }: any) {
  return <div className={`animate-pulse bg-gray-300 dark:bg-gray-700 rounded w-${width} ${height}`} />;
}

export function SkeletonText({ lines = 3 }: any) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-4 bg-gray-300 dark:bg-gray-600 rounded ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}
