import { useState } from 'react';
import { workerFetch } from '@/lib/api';

const SAMPLE_QUERIES: { label: string; q: string }[] = [
  {
    label: '캠페인별 30일 클릭/광고비',
    q: `SELECT campaign.id, campaign.name, metrics.clicks, metrics.cost_micros\nFROM campaign\nWHERE segments.date DURING LAST_30_DAYS\nORDER BY metrics.clicks DESC LIMIT 50`,
  },
  {
    label: '광고그룹별 CTR',
    q: `SELECT ad_group.id, ad_group.name, metrics.impressions, metrics.clicks, metrics.ctr\nFROM ad_group\nWHERE segments.date DURING LAST_7_DAYS LIMIT 50`,
  },
];

export default function GoogleStats() {
  const [query, setQuery] = useState(SAMPLE_QUERIES[0].q);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const r = await workerFetch<any>('/api/google-ads/internal/gaql', {
        method: 'POST',
        body: JSON.stringify({ customerId: '1581690943', query }),
      });
      setResult(r);
    } catch (e) {
      setErr((e as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
        <h1 className="text-xl font-bold text-gray-900">구글 통계 (GAQL 빌더)</h1>
      </div>
      <p className="text-sm text-gray-500">customer 1581690943 · 직접 GAQL 실행. 개발자 모드.</p>

      <div className="flex gap-2 flex-wrap">
        {SAMPLE_QUERIES.map((s, i) => (
          <button key={i} onClick={() => setQuery(s.q)}
            className="text-xs px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100">
            {s.label}
          </button>
        ))}
      </div>

      <textarea value={query} onChange={(e) => setQuery(e.target.value)}
        className="w-full h-40 px-3 py-2 border border-gray-200 rounded-lg font-mono text-xs"
        placeholder="GAQL 쿼리 입력" />

      <button onClick={run} disabled={busy}
        className="px-5 py-2 rounded-lg bg-[#4285F4] text-white text-sm font-medium disabled:opacity-50">
        {busy ? '실행 중...' : '실행'}
      </button>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{err}</div>
      )}

      {result && (
        <pre className="bg-gray-900 text-gray-100 text-[11px] p-4 rounded-lg overflow-auto max-h-96 font-mono">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
