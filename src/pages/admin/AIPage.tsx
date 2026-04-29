import { useState } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { workerFetch } from '@/lib/api';
import { Sparkles } from 'lucide-react';

type Tab = 'briefing' | 'keyword_health' | 'ad_suggestions' | 'weekly_insight';

const TABS: { key: Tab; label: string }[] = [
  { key: 'briefing', label: '오늘 브리핑' },
  { key: 'keyword_health', label: '키워드 진단' },
  { key: 'ad_suggestions', label: '광고소재 추천' },
  { key: 'weekly_insight', label: '주간 비교' },
];

export default function AIPage() {
  const { siteId } = useSite();
  const [tab, setTab] = useState<Tab>('briefing');
  const [output, setOutput] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!siteId) return;
    setBusy(true); setErr(null);
    try {
      const r = await workerFetch<any>('/ai', {
        method: 'POST',
        body: JSON.stringify({ action: tab, site_id: siteId }),
      });
      setOutput(typeof r === 'string' ? r : JSON.stringify(r, null, 2));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-violet-600" />
        <h1 className="text-xl font-bold text-gray-900">AI 분석</h1>
      </div>
      <p className="text-sm text-gray-500">Anthropic API LIVE · 4가지 분석 모드 · 사이트 {siteId}</p>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.key ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <button onClick={run} disabled={busy || !siteId}
        className="px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium disabled:opacity-50">
        {busy ? '분석 중...' : '실행'}
      </button>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{err}</div>}

      {output && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <pre className="text-sm whitespace-pre-wrap text-gray-800 font-sans">{output}</pre>
        </div>
      )}
    </div>
  );
}
