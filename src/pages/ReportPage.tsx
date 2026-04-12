import { useState } from 'react';
import { Sparkles, Mail, Loader2, CheckCircle2, AlertCircle, Lightbulb, X } from 'lucide-react';
import { workerFetch } from '@/lib/api';

interface WeeklyResult { good: string[]; improve: string[]; recommend: string[] }

export function ReportPage() {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<WeeklyResult | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true); setError('');
    try {
      const res = await workerFetch<{ data: WeeklyResult }>('/ai', {
        method: 'POST',
        body: JSON.stringify({
          action: 'weekly_insight',
          data: {
            thisWeek: { imp: 7000, clk: 350, cost: 210000, conv: 21 },
            lastWeek: { imp: 6000, clk: 280, cost: 195000, conv: 15 },
            dailyBudget: 50000,
          },
        }),
      });
      setReport(res.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSaved(true);
    setTimeout(() => setShowEmailModal(false), 1500);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            AI 주간 리포트
          </h2>
          <p className="text-sm text-gray-500 mt-1">매주 월요일 오전 9시 자동 생성</p>
        </div>
        <button
          onClick={() => setShowEmailModal(true)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          <Mail className="w-4 h-4" />
          이메일 수신 설정
        </button>
      </div>

      {/* Generate */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {!report && !loading && (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-violet-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">아직 생성된 리포트가 없습니다</h3>
            <p className="text-sm text-gray-500 mb-6">첫 번째 리포트는 다음 월요일에 자동 생성됩니다.<br />지금 바로 받아보고 싶으시면 아래 버튼을 누르세요.</p>
            <button onClick={handleGenerate} className="px-6 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
              지금 리포트 생성
            </button>
          </div>
        )}

        {loading && (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 text-violet-600 mx-auto animate-spin" />
            <p className="text-sm text-gray-500 mt-3">AI가 주간 데이터를 분석 중입니다...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {report && !loading && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">이번주 리포트</h3>
              <button onClick={handleGenerate} className="text-xs text-violet-600 hover:underline">다시 생성</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-5 border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-green-700">잘 된 점</h4>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  {report.good.map((g, i) => <li key={i} className="flex gap-1.5"><span>•</span><span>{g}</span></li>)}
                </ul>
              </div>
              <div className="bg-amber-50 rounded-lg p-5 border border-amber-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <h4 className="font-semibold text-amber-700">개선 필요</h4>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  {report.improve.map((g, i) => <li key={i} className="flex gap-1.5"><span>•</span><span>{g}</span></li>)}
                </ul>
              </div>
              <div className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-700">추천 조치</h4>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  {report.recommend.map((g, i) => <li key={i} className="flex gap-1.5"><span>•</span><span>{g}</span></li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <button onClick={() => setShowEmailModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">이메일 수신 설정</h3>
            <p className="text-sm text-gray-500 mb-4">매주 월요일 오전 9시에 AI 주간 리포트를 이메일로 받아보세요.</p>
            <form onSubmit={handleSaveEmail} className="space-y-3">
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button type="submit" className="w-full py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
                {emailSaved ? '✓ 저장 완료' : '저장하기'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
