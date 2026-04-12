// 히트AD 공용 로딩 스켈레톤
export const SkeletonRow = () => (
  <div className="flex gap-4 p-3 animate-pulse">
    <div className="h-4 bg-slate-200 rounded w-24" />
    <div className="h-4 bg-slate-200 rounded w-32" />
    <div className="h-4 bg-slate-200 rounded w-20" />
    <div className="h-4 bg-slate-200 rounded w-28" />
  </div>
);

export const SkeletonTable = ({ rows = 5 }: { rows?: number }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="h-10 bg-slate-100" />
    {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
  </div>
);

export const SkeletonKpi = () => (
  <div className="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
    <div className="h-3 bg-slate-200 rounded w-16 mb-3" />
    <div className="h-8 bg-slate-200 rounded w-24" />
  </div>
);

// React.lazy 로딩 시 표시되는 풀화면 스켈레톤 (탭 전환)
export const HitAdSkeleton = () => (
  <div className="p-4 space-y-4 animate-pulse">
    <div className="h-8 bg-slate-200 rounded w-48" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-24 bg-slate-200 rounded-xl" />
      ))}
    </div>
    <div className="h-64 bg-slate-200 rounded-xl" />
    <div className="h-48 bg-slate-200 rounded-xl" />
  </div>
);
