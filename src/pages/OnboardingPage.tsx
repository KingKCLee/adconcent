import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [bizNum, setBizNum] = useState('');
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name || !industry) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/tenant/onboarding', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, business_number: bizNum, industry }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: r.statusText }));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      navigate('/workspace/connect');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white py-16 px-4">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">AdConcent 시작하기</h1>
        <p className="text-gray-400 mb-8 text-sm">FREE tier — 월 광고비 ₩100만 한도, 일일 API 1,000회</p>

        <div className="space-y-5 bg-gray-900 p-6 rounded-2xl border border-gray-800">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">사업자명 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 outline-none"
              placeholder="예: 더블유부동산"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">사업자등록번호 (선택)</label>
            <input
              value={bizNum}
              onChange={(e) => setBizNum(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 outline-none"
              placeholder="000-00-00000"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">광고 분야 *</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 outline-none"
            >
              <option value="">선택</option>
              <option value="real_estate">부동산/분양</option>
              <option value="ecommerce">이커머스</option>
              <option value="education">교육</option>
              <option value="finance">금융/대출</option>
              <option value="health">병원/뷰티</option>
              <option value="other">기타</option>
            </select>
          </div>

          {err && (
            <div className="bg-red-900/40 border border-red-800 text-red-200 px-3 py-2 rounded-lg text-sm">
              {err}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !name || !industry}
            className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : 'FREE tier로 시작'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingPage;
