import { useEffect, useState } from 'react';

interface SiteRow {
  site_id: string;
  domain: string | null;
  plan: string;
  tenant_id: number;
  naver_connected: number;
  google_connected: number;
}

interface TenantRow {
  id: number;
  slug: string;
  name: string;
  plan_tier: string;
  monthly_ad_budget_krw: number;
  monthly_used_krw: number;
  api_quota_daily: number;
  api_used_today: number;
  owner_email: string;
}

export function ConnectPage() {
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [siteName, setSiteName] = useState('');
  const [domain, setDomain] = useState('');
  const [naverCust, setNaverCust] = useState('');
  const [naverKey, setNaverKey] = useState('');
  const [naverSec, setNaverSec] = useState('');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/tenant/me', { credentials: 'include' });
      if (r.status === 403) {
        window.location.href = '/onboarding';
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setTenant(j.tenant);
      setSites(j.sites || []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addSite() {
    if (!siteName || !domain) return;
    setAdding(true);
    setMsg(null);
    try {
      const siteId = siteName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const r = await fetch('/sites/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          domain,
          owner_email: tenant?.owner_email,
          naver_customer_id: naverCust || undefined,
          api_key: naverKey || undefined,
          secret_key: naverSec || undefined,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: r.statusText }));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      setSiteName('');
      setDomain('');
      setNaverCust('');
      setNaverKey('');
      setNaverSec('');
      setMsg('추가 완료');
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-400">로드 중...</div>;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">광고 채널 연결</h1>
      {tenant && (
        <p className="text-sm text-gray-500 mb-8">
          {tenant.name} · {tenant.plan_tier} ·
          월 광고비 ₩{tenant.monthly_used_krw.toLocaleString()} / ₩{tenant.monthly_ad_budget_krw.toLocaleString()}
        </p>
      )}

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">내 사이트 ({sites.length})</h2>
        {sites.length === 0 ? (
          <p className="text-gray-500 text-sm">등록된 사이트가 없습니다. 아래에서 추가하세요.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sites.map((s) => (
              <div key={s.site_id} className="border border-gray-200 rounded-xl p-4">
                <div className="font-bold">{s.domain || s.site_id}</div>
                <div className="text-xs text-gray-500">{s.site_id} · {s.plan?.toUpperCase()}</div>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className={s.naver_connected
                    ? 'bg-green-100 text-green-800 px-2 py-1 rounded'
                    : 'bg-gray-100 text-gray-500 px-2 py-1 rounded'}>
                    Naver {s.naver_connected ? '✓' : '—'}
                  </span>
                  <span className={s.google_connected
                    ? 'bg-green-100 text-green-800 px-2 py-1 rounded'
                    : 'bg-gray-100 text-gray-500 px-2 py-1 rounded'}>
                    Google {s.google_connected ? '✓' : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border border-gray-200 rounded-xl p-6 max-w-2xl">
        <h2 className="text-lg font-bold mb-4">+ 사이트 추가</h2>

        <div className="space-y-3">
          <input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="사이트 ID (예: myshop)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="도메인 (예: myshop.com)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />

          <details className="border border-gray-200 rounded-lg p-3">
            <summary className="cursor-pointer font-medium text-sm">
              Naver 검색광고 연결 (선택)
            </summary>
            <div className="mt-3 space-y-2">
              <input
                value={naverCust}
                onChange={(e) => setNaverCust(e.target.value)}
                placeholder="Customer ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
              <input
                value={naverKey}
                onChange={(e) => setNaverKey(e.target.value)}
                placeholder="API Key (액세스라이선스)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
              <input
                type="password"
                value={naverSec}
                onChange={(e) => setNaverSec(e.target.value)}
                placeholder="Secret Key (비밀키)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                <a
                  href="https://searchad.naver.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  searchad.naver.com
                </a>
                {' '}→ 도구 → API 사용관리에서 발급
              </p>
            </div>
          </details>

          {msg && (
            <div className="text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">{msg}</div>
          )}

          <button
            onClick={addSite}
            disabled={adding || !siteName || !domain}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg disabled:opacity-40"
          >
            {adding ? '추가 중...' : '사이트 추가'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConnectPage;
