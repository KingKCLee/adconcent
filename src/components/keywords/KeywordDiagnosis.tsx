import { useState, useEffect } from 'react';
import { Loader2, ExternalLink, X } from 'lucide-react';
import { fetchCampaigns, fetchAdGroups, fetchAds, fetchBidEstimates, fetchBizMoney } from '@/lib/naverApi';
import { estimateToRankBids } from '@/lib/bidOptimizer';
import { diagnoseKeyword, type DiagnosisResult } from '@/lib/aiAnalyzer';
import type { NaverKeyword } from '@/lib/types';

interface Props {
  adAccountId: string;
  keyword: NaverKeyword;
  onClose: () => void;
}

export default function KeywordDiagnosis({ adAccountId, keyword, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  // 진단 자동 실행
  useEffect(() => {
    (async () => {
      try {
        // 병렬 조회
        const [campaigns, bm, estimates] = await Promise.all([
          fetchCampaigns(adAccountId),
          fetchBizMoney(adAccountId),
          fetchBidEstimates(adAccountId, keyword.nccKeywordId, keyword.keyword),
        ]);

        // 캠페인/광고그룹 상태 확인
        const campaign = campaigns.find(c => c.nccCampaignId === (keyword as any).nccCampaignId);
        const campaignOn = campaign?.status === 'ELIGIBLE' && !campaign?.userLock;

        let adGroupOn = true;
        let adInspectStatus = 'APPROVED';
        let dailyBudget = campaign?.dailyBudget || 0;
        let todayCost = 0;

        try {
          if (campaign) {
            const adGroups = await fetchAdGroups(adAccountId, campaign.nccCampaignId);
            const ag = adGroups.find(g => g.nccAdgroupId === keyword.nccAdgroupId);
            adGroupOn = ag?.status === 'ELIGIBLE' && !ag?.userLock;
            dailyBudget = ag?.dailyBudget || dailyBudget;
          }
        } catch {}

        try {
          const ads = await fetchAds(adAccountId, keyword.nccAdgroupId);
          if (ads.length > 0) {
            adInspectStatus = ads[0].inspectStatus || 'APPROVED';
          }
        } catch {}

        const rankBids = estimateToRankBids(estimates);

        const diagnosis = diagnoseKeyword({
          keyword: keyword.keyword,
          bidAmt: keyword.bidAmt,
          status: keyword.status || 'ELIGIBLE',
          qiGrade: keyword.nccQi?.qiGrade || 4,
          campaignOn,
          adGroupOn,
          keywordOn: keyword.status === 'ELIGIBLE' && !keyword.userLock,
          adInspectStatus,
          bizMoney: bm,
          todayCost,
          dailyBudget,
          rank1Bid: rankBids[1] || 0,
          rank3Bid: rankBids[3] || 0,
        });

        setResult(diagnosis);
      } catch (e) {
        setResult({
          keyword: keyword.keyword,
          items: [{ icon: '🔴', label: '진단 실패', detail: (e as Error).message, severity: 'error' }],
          cause: '진단 중 오류 발생',
          recommendations: ['새로고침 후 다시 시도하세요'],
          rankScore: 0,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
          <h3 className="font-bold text-foreground">
            <span className="text-lg mr-2">🔍</span>
            {keyword.keyword} 노출 진단
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-blue-500" />
              <p className="text-sm text-muted-foreground">진단 중... 캠페인/소재/입찰가 확인</p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* 체크리스트 */}
              <div className="space-y-2">
                {result.items.map((item, i) => (
                  <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
                    item.severity === 'error' ? 'bg-red-50' :
                    item.severity === 'warn' ? 'bg-yellow-50' :
                    item.severity === 'info' ? 'bg-blue-50' : 'bg-green-50/50'
                  }`}>
                    <span className="shrink-0 text-base">{item.icon}</span>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      {item.detail && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{item.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* 추정 원인 */}
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-800 mb-1">📊 추정 원인</p>
                <p className="text-sm text-blue-900">{result.cause}</p>
              </div>

              {/* 권장 조치 */}
              {result.recommendations.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">💡 권장 조치</p>
                  <div className="space-y-1">
                    {result.recommendations.map((rec, i) => (
                      <p key={i} className="text-sm text-gray-800">{i + 1}. {rec}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* 네이버 직접 확인 */}
              <a
                href={`https://search.naver.com/search.naver?query=${encodeURIComponent(keyword.keyword)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#03C75A] text-white rounded-lg text-sm font-medium hover:bg-[#02b351] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                네이버에서 직접 검색하여 확인
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
