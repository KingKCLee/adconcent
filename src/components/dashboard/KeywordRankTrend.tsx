import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'

const COLORS = [
  '#2563eb','#16a34a','#dc2626','#d97706',
  '#7c3aed','#0891b2','#be185d','#65a30d',
  '#ea580c','#6b7280'
]

export default function KeywordRankTrend({ days = 7 }: { days?: number }) {
  const [data, setData] = useState<any[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRankTrend()
  }, [days])

  const fetchRankTrend = async () => {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data: logs } = await supabase
      .from('rank_logs')
      .select('keyword, rank, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })

    if (!logs || logs.length === 0) { setData([]); setKeywords([]); setLoading(false); return }

    const byDate: Record<string, Record<string, number>> = {}
    const kwSet = new Set<string>()

    logs.forEach((log: any) => {
      const date = new Date(log.created_at)
        .toLocaleDateString('ko-KR', {
          month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul'
        })
      if (!byDate[date]) byDate[date] = {}
      if (!byDate[date][log.keyword] || log.rank < byDate[date][log.keyword]) {
        byDate[date][log.keyword] = log.rank
      }
      kwSet.add(log.keyword)
    })

    const kwList = Array.from(kwSet)
    const kwAvgRank = kwList.map(kw => {
      const ranks = Object.values(byDate).map(d => d[kw]).filter(Boolean)
      return { kw, avg: ranks.reduce((a, b) => a + b, 0) / ranks.length }
    }).sort((a, b) => a.avg - b.avg).slice(0, 10).map(x => x.kw)

    setKeywords(kwAvgRank)

    const chartData = Object.entries(byDate).map(([date, ranks]) => ({
      date,
      ...kwAvgRank.reduce((acc, kw) => ({
        ...acc,
        [kw]: ranks[kw] || null
      }), {})
    }))

    setData(chartData)
    setLoading(false)
  }

  if (loading) return (
    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
      순위 데이터 로딩 중...
    </div>
  )

  if (!data.length) return (
    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
      순위 데이터 없음
    </div>
  )

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis
            reversed
            domain={[1, 15]}
            tickCount={5}
            tick={{ fontSize: 11 }}
            label={{ value: '순위', angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <Tooltip
            formatter={(val: any, name: string) => [`${val}위`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {keywords.map((kw, i) => (
            <Line
              key={kw}
              type="monotone"
              dataKey={kw}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={1.5}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
