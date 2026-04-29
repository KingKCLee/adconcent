import { useEffect, useState } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { workerFetch } from '@/lib/api';

export default function NaverSettings() {
  const { siteId, refresh } = useSite();
  const [cust, setCust] = useState('');
  const [key, setKey] = useState('');
  const [sec, setSec] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<{ naver_customer_id?: string | null } | null>(null);

  useEffect(() => {
    if (!siteId) return;
    workerFetch<{ data: { naver_customer_id: string | null } }>(`/sites/${siteId}`)
      .then((r) => setInfo(r.data))
      .catch(() => {});
  }, [siteId]);

  async function save() {
    if (!siteId) return;
    setBusy(true);
    setMsg(null);
    try {
      await workerFetch(`/sites/${siteId}`, {
        method: 'PUT',
        body: JSON.stringify({
          naver_customer_id: cust || undefined,
          api_key: key || undefined,
          secret_key: sec || undefined,
        }),
      });
      setMsg('저장 완료 ✓ — 자동입찰 cron 다음 5분 주기에 적용');
      setCust(''); setKey(''); setSec('');
      await refresh();
    } catch (e) {
      setMsg(`저장 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#03C75A]" />
        <h1 className="text-xl font-bold text-gray-900">네이버 설정</h1>
      </div>
      <p className="text-sm text-gray-500">자격증명 등록 후 자동입찰 cron이 즉시 동작합니다.</p>

      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl">
        <h2 className="font-bold text-sm mb-3">자격증명 ({siteId})</h2>
        <p className="text-xs text-gray-500 mb-4">
          현재 등록 상태: {info?.naver_customer_id ? '✓ 등록됨' : '❌ 미등록'}
        </p>

        <div className="space-y-2">
          <input value={cust} onChange={(e) => setCust(e.target.value)}
            placeholder="Customer ID" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
          <input value={key} onChange={(e) => setKey(e.target.value)}
            placeholder="API Key (액세스라이선스)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
          <input type="password" value={sec} onChange={(e) => setSec(e.target.value)}
            placeholder="Secret Key (비밀키)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
          <p className="text-[11px] text-gray-500">
            <a href="https://searchad.naver.com" target="_blank" rel="noreferrer" className="underline">searchad.naver.com</a> → 도구 → API 사용관리에서 발급
          </p>
          <button onClick={save} disabled={busy || (!cust && !key && !sec)}
            className="w-full bg-[#03C75A] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {busy ? '...' : '저장'}
          </button>
          {msg && <div className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded">{msg}</div>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl">
        <h2 className="font-bold text-sm mb-3">시간대별 multiplier (보라웨어 패턴)</h2>
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left">시간대</th>
              <th className="px-2 py-1.5 text-center">multiplier (기본)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t"><td className="px-2 py-1.5">아침 6-11시</td><td className="px-2 py-1.5 text-center">1.2x</td></tr>
            <tr className="border-t"><td className="px-2 py-1.5">낮 12-17시</td><td className="px-2 py-1.5 text-center">1.0x</td></tr>
            <tr className="border-t"><td className="px-2 py-1.5">저녁 18-23시</td><td className="px-2 py-1.5 text-center">1.3x</td></tr>
            <tr className="border-t"><td className="px-2 py-1.5">야간 0-5시</td><td className="px-2 py-1.5 text-center">0.5x</td></tr>
            <tr className="border-t"><td className="px-2 py-1.5">주말</td><td className="px-2 py-1.5 text-center">0.8x</td></tr>
          </tbody>
        </table>
        <p className="text-[11px] text-gray-400 mt-3">그룹 전략 단위 multiplier 편집은 다음 sprint.</p>
      </div>
    </div>
  );
}
