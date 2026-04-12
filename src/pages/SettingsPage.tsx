import { useState } from 'react';
import { Globe, Code, Key, Copy, Check, Plus } from 'lucide-react';

const WORKER_URL = import.meta.env.VITE_ADCONCENT_WORKER_URL;
const SITE_ID = 'hitbunyang';
const SCRIPT_TAG = `<script src="${WORKER_URL}/collect?site_id=${SITE_ID}" async></script>`;

interface Site {
  domain: string;
  scriptInstalled: boolean;
  naverConnected: boolean;
}

const initialSites: Site[] = [
  { domain: 'hitbunyang.com', scriptInstalled: true, naverConnected: true },
];

export function SettingsPage() {
  const [sites] = useState<Site[]>(initialSites);
  const [copied, setCopied] = useState(false);
  const [installCheck, setInstallCheck] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [customerId, setCustomerId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleCopy = () => {
    navigator.clipboard.writeText(SCRIPT_TAG);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallCheck = async () => {
    setInstallCheck('checking');
    try {
      const res = await fetch(`${WORKER_URL}/health`);
      setInstallCheck(res.ok ? 'ok' : 'fail');
    } catch {
      setInstallCheck('fail');
    }
  };

  const handleSaveNaver = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    // TODO: Worker /sites 또는 Supabase 저장
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. 사이트 관리 */}
      <section className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">사이트 관리</h3>
          </div>
          <button className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-3 h-3" />
            사이트 추가
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {sites.map((site) => (
            <div key={site.domain} className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{site.domain}</p>
                <p className="text-xs text-gray-400 mt-0.5">site_id: {SITE_ID}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  site.scriptInstalled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {site.scriptInstalled ? '✓ 스크립트' : '미설치'}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  site.naverConnected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {site.naverConnected ? '✓ 네이버 연동' : '미연동'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. 스크립트 설치 가이드 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Code className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">스크립트 설치 가이드</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">아래 코드를 광고 랜딩 페이지 <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">&lt;head&gt;</code> 영역에 붙여넣으세요.</p>
        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2 mb-4">
          <code className="text-xs flex-1 overflow-x-auto text-gray-700 font-mono">{SCRIPT_TAG}</code>
          <button onClick={handleCopy} className="p-2 rounded hover:bg-gray-200 text-gray-500 shrink-0">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
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
          {installCheck === 'ok' && <span className="text-sm text-green-600 flex items-center gap-1"><Check className="w-4 h-4" /> Worker 정상</span>}
          {installCheck === 'fail' && <span className="text-sm text-red-600">Worker 응답 실패</span>}
        </div>
      </section>

      {/* 3. 네이버 광고 계정 연결 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">네이버 광고 계정 연결</h3>
        </div>
        <form onSubmit={handleSaveNaver} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">고객 ID (Customer ID)</label>
            <input
              type="text" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              placeholder="3106493"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">API 액세스 라이선스 키</label>
            <input
              type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="0100000000..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">비밀 키 (Secret Key)</label>
            <input
              type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)}
              placeholder="AQAAAA..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <p className="text-xs text-gray-400">
            네이버 검색광고 → 도구 → API 사용관리에서 발급받을 수 있습니다.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit" disabled={saveStatus === 'saving'}
              className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saveStatus === 'saving' ? '저장 중...' : '저장'}
            </button>
            {saveStatus === 'saved' && <span className="text-sm text-green-600 flex items-center gap-1"><Check className="w-4 h-4" /> 저장 완료</span>}
          </div>
        </form>
      </section>
    </div>
  );
}
