import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Loader2, Users } from 'lucide-react';

// 최근 24시간 동안 rank_logs 의 total_ads 평균을 시간대(KST 0~23)별로 집계
// → 경쟁사 광고 수 트렌드 차트
interface HourBucket { hour: number; avgAds: number; samples: number }

export default function CompetitorTrendChart() {
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { data } = await supabase
          .from('rank_logs')
          .select('total_ads, created_at')
          .gte('created_at', since);
        if (cancelled) return;
        const agg: Record<number, { sum: number; n: number }> = {};
        for (let h = 0; h < 24; h++) agg[h] = { sum: 0, n: 0 };
        for (const row of (data || [])) {
          const d = new Date(row.created_at);
          const kstHour = new Date(d.getTime() + 9 * 3600 * 1000).getUTCHours();
          agg[kstHour].sum += (row.total_ads || 0);
          agg[kstHour].n += 1;
        }
        const next: HourBucket[] = [];
        for (let h = 0; h < 24; h++) {
          next.push({
            hour: h,
            avgAds: agg[h].n > 0 ? +(agg[h].sum / agg[h].n).toFixed(1) : 0,
            samples: agg[h].n,
          });
        }
        setBuckets(next);
      } catch { setBuckets([]); }
      finally { setLoading(false); }
    };
    load();
    const t = setInterval(load, 3 * 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const hasData = buckets.some(b => b.samples > 0);
  const maxHour = buckets.reduce((max, b) => b.avgAds > max.avgAds ? b : max, buckets[0] || { hour: 0, avgAds: 0, samples: 0 });
  const minHour = buckets.filter(b => b.samples > 0).reduce((min, b) => b.avgAds < min.avgAds ? b : min, { hour: 0, avgAds: Infinity, samples: 0 } as HourBucket);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Users className="w-4 h-4 text-purple-500" />경쟁사 광고 수 트렌드 (24시간)
        </div>
        {hasData && (
          <div className="text-[10px] text-slate-500 flex gap-3">
            <span>🔴 많음: <b>{maxHour.hour}시 {maxHour.avgAds}개</b></span>
            {minHour.avgAds !== Infinity && <span>🟢 적음: <b>{minHour.hour}시 {minHour.avgAds}개</b></span>}
          </div>
        )}
      </div>
      <div className="h-40">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-1" />로딩 중
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs">
            아직 수집된 데이터가 없습니다 — rank-tracker 가 3분마다 수집
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 11 }}
                formatter={(v: number) => [`${v}개`, '평균 광고 수']}
                labelFormatter={(h: number) => `${h}시`}
              />
              <Line type="monotone" dataKey="avgAds" stroke="#a855f7" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-[10px] text-slate-500 mt-2">
        💡 경쟁사 광고가 많은 시간대는 입찰가를 올려야 상위 노출 유지, 적은 시간대는 절감 여력 있음
      </p>
    </div>
  );
}
