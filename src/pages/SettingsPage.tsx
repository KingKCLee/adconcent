import { useEffect, useState } from 'react';
import { Globe, Code, Key, Copy, Check, Plus, X, Loader2, Lock } from 'lucide-react';
import { workerFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const WORKER_URL = import.meta.env.VITE_ADCONCENT_WORKER_URL;

interface Site {
  site_id: string;
  domain: string;
  plan?: string;
  user_email?: string;
  script_installed?: number | boolean;
  naver_customer_id?: string | null;
  api_key?: string | null;
  secret_key?: string | null;
  created_at?: string;
}

const planColor = (plan?: string) => {
  switch ((plan ?? 'free').toLowerCase()) {
    case 'pro':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'growth':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'starter':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

const scriptTagFor = (siteId: string) =>
  `<!-- AdConcent 부정클릭 차단 픽셀 -->
<script>
(function() {
  var params = new URLSearchParams(window.location.search);
  var data = {
    site_id: '${siteId}',
    keyword: params.get('nk') || params.get('keyword') || '',
    device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'pc',
    referrer: document.referrer,
    landing_url: window.location.href,
    ts: Date.now()
  };
  fetch('${WORKER_URL}/collect', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data),
    keepalive: true
  }).catch(function(){});
})();
</script>`;

export function SettingsPage() {
  const [email, setEmail] = useState<string>('');
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Script install
  const [copied, setCopied] = useState(false);
  const [installCheck, setInstallCheck] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

  // Naver form
  const [customerId, setCustomerId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  const loadSites = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email ?? '';
      setEmail(userEmail);

      const qs = userEmail ? `?email=${encodeURIComponent(userEmail)}` : '';
      const resp = await workerFetch<{ data?: Site[]; sites?: Site[] } | Site[]>(`/sites/list${qs}`);
      const list: Site[] = Array.isArray(resp) ? resp : resp?.data ?? resp?.sites ?? [];
      setSites(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].site_id);
      }
    } catch {
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = sites.find((s) => s.site_id === selectedId);

  // Sync naver form when selected site changes
  useEffect(() => {
    if (selected) {
      setCustomerId(selected.naver_customer_id ?? '');
      setApiKey(selected.api_key ?? '');
      setSecretKey(selected.secret_key ?? '');
      setSaveStatus('idle');
    }
  }, [selectedId, selected?.naver_customer_id]);

  const handleCopy = () => {
    if (!selected) return;
    navigator.clipboard.writeText(scriptTagFor(selected.site_id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallCheck = async () => {
    if (!selected) return;
    setInstallCheck('checking');
    try {
      const res = await fetch(`${WORKER_URL}/sites/${selected.site_id}/install-status`).catch(() => null);
      if (res && res.ok) {
        setInstallCheck('ok');
      } else {
        const ping = await fetch(`${WORKER_URL}/health`);
        setInstallCheck(ping.ok ? 'ok' : 'fail');
      }
    } catch {
      setInstallCheck('fail');
    }
  };

  const handleSaveNaver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaveStatus('saving');
    try {
      await workerFetch(`/sites/${selected.site_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          naver_customer_id: customerId,
          api_key: apiKey,
          secret_key: secretKey,
        }),
      });
      setSaveStatus('saved');
      showToast('네이버 계정 연결 완료');
      loadSites();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveStatus('error');
      showToast(`저장 실패: ${err?.message ?? ''}`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. 사이트 관리 */}
      <section className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">사이트 관리</h3>
            {email && <span className="text-xs text-gray-400 ml-2">{email}</span>}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-3 h-3" />
            사이트 추가
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            불러오는 중...
          </div>
        ) : sites.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            등록된 사이트가 없습니다. "사이트 추가"로 시작하세요.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sites.map((site) => {
              const isSelected = site.site_id === selectedId;
              const scriptOk = !!site.script_installed;
              const naverOk = !!site.naver_customer_id;
              return (
                <button
                  key={site.site_id}
                  onClick={() => setSelectedId(site.site_id)}
                  className={`w-full text-left px-5 py-4 flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-blue-50/40' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isSelected && <div className="w-1 h-10 bg-blue-600 rounded-full -ml-2" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{site.domain}</p>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase ${planColor(
                            site.plan,
                          )}`}
                        >
                          {site.plan ?? 'free'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">site_id: {site.site_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        scriptOk ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {scriptOk ? '✓ 스크립트' : '미설치'}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        naverOk ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {naverOk ? '✓ 네이버 연동' : '미연동'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. 스크립트 설치 가이드 */}
      {selected && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Code className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">스크립트 설치 가이드</h3>
            <span className="text-xs text-gray-400">— {selected.domain}</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            아래 픽셀 코드를 광고 랜딩 페이지{' '}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">&lt;head&gt;</code> 영역 또는 페이지 최상단에 붙여넣으세요.
            URL 파라미터 <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">?nk=키워드</code>를 자동 수집합니다.
          </p>
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <pre className="text-[11px] text-gray-700 font-mono whitespace-pre-wrap break-all max-h-64 overflow-auto">{scriptTagFor(selected.site_id)}</pre>
            <button
              onClick={handleCopy}
              className="mt-3 text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '복사됨' : '코드 복사'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleInstallCheck}
              disabled={installCheck === 'checking'}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {installCheck === 'checking' ? '확인 중...' : '설치 확인'}
            </button>
            {installCheck === 'ok' && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> 정상 작동
              </span>
            )}
            {installCheck === 'fail' && <span className="text-sm text-red-600">스크립트 응답 실패</span>}
          </div>
        </section>
      )}

      {/* 3. 네이버 광고 계정 연결 */}
      {selected && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">네이버 광고 계정 연결</h3>
            {selected.naver_customer_id && (
              <span className="ml-2 text-xs text-green-600 flex items-center gap-1">
                <Check className="w-3 h-3" /> 연결됨
              </span>
            )}
          </div>
          <form onSubmit={handleSaveNaver} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">고객 ID (Customer ID)</label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="3106493"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API 액세스 라이선스 키</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="0100000000..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">비밀 키 (Secret Key)</label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="AQAAAA..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <p className="text-xs text-gray-400">
              네이버 검색광고 → 도구 → API 사용관리에서 발급받을 수 있습니다.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saveStatus === 'saving'}
                className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
              >
                {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
                {saveStatus === 'saving' ? '저장 중...' : '저장'}
              </button>
              {saveStatus === 'saved' && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> 연결 완료
                </span>
              )}
              {saveStatus === 'error' && <span className="text-sm text-red-600">저장 실패</span>}
            </div>
          </form>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-500">
            <Lock className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
            <span>키 정보는 Worker D1 데이터베이스에 암호화되어 저장됩니다.</span>
          </div>
        </section>
      )}

      {/* 사이트 추가 모달 */}
      {showAdd && (
        <AddSiteModal
          email={email}
          onClose={() => setShowAdd(false)}
          onCreated={(siteId) => {
            setShowAdd(false);
            showToast('사이트 등록 완료');
            loadSites().then(() => setSelectedId(siteId));
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- Add Site Modal ---------- */

function AddSiteModal(props: { email: string; onClose: () => void; onCreated: (siteId: string) => void }) {
  const { email, onClose, onCreated } = props;
  const [siteId, setSiteId] = useState('');
  const [domain, setDomain] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdScript, setCreatedScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const valid = /^[a-z0-9-]+$/.test(siteId) && siteId.length >= 3 && domain.length > 3;

  const submit = async () => {
    setError(null);
    if (!valid) {
      setError('site_id는 영문 소문자/숫자/하이픈만, 도메인은 4자 이상');
      return;
    }
    setSaving(true);
    try {
      await workerFetch('/sites/register', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          domain,
          email,
          plan: 'free',
        }),
      });
      setCreatedScript(scriptTagFor(siteId));
    } catch (e: any) {
      setError(e?.message ?? '등록 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!createdScript) return;
    navigator.clipboard.writeText(createdScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        {!createdScript ? (
          <>
            <h3 className="text-lg font-bold text-gray-900 mb-1">사이트 추가</h3>
            <p className="text-xs text-gray-500 mb-5">광고를 운영하는 사이트를 등록하세요.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">site_id</label>
                <input
                  type="text"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value.toLowerCase())}
                  placeholder="hitbunyang"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">영문 소문자, 숫자, 하이픈만 사용 (3자 이상)</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">도메인</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="hitbunyang.com"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={submit}
                disabled={saving || !valid}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                등록
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">등록 완료!</h3>
            <p className="text-xs text-gray-500 mb-4">아래 스크립트를 광고 랜딩 페이지에 설치하세요.</p>
            <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2 mb-5">
              <code className="text-xs flex-1 overflow-x-auto text-gray-700 font-mono whitespace-nowrap">
                {createdScript}
              </code>
              <button onClick={handleCopy} className="p-2 rounded hover:bg-gray-200 text-gray-500 shrink-0">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={() => onCreated(siteId)}
              className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              완료
            </button>
          </>
        )}
      </div>
    </div>
  );
}
