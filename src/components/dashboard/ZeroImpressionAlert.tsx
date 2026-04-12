import { useState, useEffect } from 'react';
import { AlertTriangle, X, Loader2, Sparkles, Check, RefreshCcw, Trash2 } from 'lucide-react';
import {
  fetchCampaigns, fetchAdGroups, fetchKeywords, fetchKeywordStats,
  getRelatedKeywords, fetchBidEstimates, updateKeywordBid, deleteKeyword, addKeywords,
  type BidEstimate,
} from '@/lib/naverApi';
import { toast } from 'sonner';

interface Props { adAccountId: string; onNavigate?: (tab: string) => void }

interface ZeroKeyword {
  id: string;
  adGroupId: string;
  keyword: string;
  bidAmt: number;
  monthlySearch: number;  // 0 = 미확인
  estimates?: BidEstimate[];
  loadingEst?: boolean;
  suggestions?: SuggestionKw[];
  loadingSug?: boolean;
}
interface SuggestionKw { keyword: string; monthlyTotal: number }

const MIN_BID = 70;

export default function ZeroImpressionAlert({ adAccountId, onNavigate }: Props) {
  const [zeroKws, setZeroKws] = useState<ZeroKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // ====== 초기 스캔 ======
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const camps = (await fetchCampaigns(adAccountId)).filter(c => c.status === 'ELIGIBLE');
        const allKws: { id: string; adGroupId: string; keyword: string; bidAmt: number }[] = [];
        for (const c of camps) {
          const ags = await fetchAdGroups(adAccountId, c.nccCampaignId);
          for (const ag of ags) {
            const kws = await fetchKeywords(adAccountId, ag.nccAdgroupId);
            for (const k of kws) {
              if (k.status === 'ELIGIBLE' && !k.userLock) {
                allKws.push({ id: k.nccKeywordId, adGroupId: ag.nccAdgroupId, keyword: k.keyword, bidAmt: k.bidAmt });
              }
            }
          }
        }
        if (allKws.length === 0) { setZeroKws([]); return; }

        // 7일 stats → 노출 0 필터
        const stats = await fetchKeywordStats(adAccountId, allKws.map(k => k.id));
        const impMap: Record<string, number> = {};
        for (const s of stats) impMap[s.id] = (impMap[s.id] || 0) + (s.impCnt || 0);
        const zeros = allKws.filter(k => (impMap[k.id] || 0) === 0).slice(0, 10);
        if (zeros.length === 0) { setZeroKws([]); return; }

        // 검색량
        const volumes: Record<string, number> = {};
        for (let i = 0; i < zeros.length; i += 5) {
          const batch = zeros.slice(i, i + 5).map(k => k.keyword);
          try {
            const related = await getRelatedKeywords(adAccountId, batch);
            for (const r of related) {
              if (batch.includes(r.relKeyword)) {
                volumes[r.relKeyword] = (r.monthlyPcQcCnt || 0) + (r.monthlyMobileQcCnt || 0);
              }
            }
          } catch { /* skip */ }
        }

        setZeroKws(zeros.map(k => ({
          id: k.id, adGroupId: k.adGroupId, keyword: k.keyword, bidAmt: k.bidAmt,
          monthlySearch: volumes[k.keyword] || 0,
        })));
      } catch { /* skip */ }
      finally { setLoading(false); }
    })();
  }, [adAccountId]);

  // ====== 낭비 광고비 추정 ======
  // (bidAmt × 예상 잠재 클릭) — 검색량 0/적은 키워드는 "현재 bid × 30일" 으로 대략 낭비 가능 금액 표시
  const estimatedWaste = zeroKws.reduce((s, k) => {
    if (k.monthlySearch === 0) return s + k.bidAmt * 30; // 클릭 없더라도 매일 입찰 시도 발생 가정치
    if (k.monthlySearch < 100) return s + Math.round(k.bidAmt * 5);
    return s;
  }, 0);

  if (loading || zeroKws.length === 0) return null;

  // ====== 키워드 1개 선택 시 경쟁 입찰가 조회 (lazy) ======
  const loadEstimatesFor = async (id: string) => {
    setZeroKws(prev => prev.map(k => k.id === id ? { ...k, loadingEst: true } : k));
    const target = zeroKws.find(k => k.id === id);
    if (!target) return;
    try {
      const est = await fetchBidEstimates(adAccountId, id, target.keyword);
      setZeroKws(prev => prev.map(k => k.id === id ? { ...k, estimates: est, loadingEst: false } : k));
    } catch {
      setZeroKws(prev => prev.map(k => k.id === id ? { ...k, estimates: [], loadingEst: false } : k));
    }
  };

  // 유사 키워드 추천 조회 (lazy)
  const loadSuggestionsFor = async (id: string) => {
    setZeroKws(prev => prev.map(k => k.id === id ? { ...k, loadingSug: true } : k));
    const target = zeroKws.find(k => k.id === id);
    if (!target) return;
    try {
      const related = await getRelatedKeywords(adAccountId, [target.keyword]);
      const suggestions: SuggestionKw[] = related
        .filter(r => r.relKeyword !== target.keyword)
        .map(r => ({ keyword: r.relKeyword, monthlyTotal: (r.monthlyPcQcCnt || 0) + (r.monthlyMobileQcCnt || 0) }))
        .filter(r => r.monthlyTotal >= 100)
        .sort((a, b) => b.monthlyTotal - a.monthlyTotal)
        .slice(0, 5);
      setZeroKws(prev => prev.map(k => k.id === id ? { ...k, suggestions, loadingSug: false } : k));
    } catch {
      setZeroKws(prev => prev.map(k => k.id === id ? { ...k, suggestions: [], loadingSug: false } : k));
    }
  };

  // ====== 개별 액션 ======
  const handleLowerBid = async (kw: ZeroKeyword) => {
    setProcessingId(kw.id);
    try {
      const ok = await updateKeywordBid(adAccountId, kw.id, MIN_BID, kw.adGroupId);
      if (ok) {
        toast.success(`${kw.keyword} 입찰가 ${MIN_BID}원으로 조정`);
        setZeroKws(prev => prev.map(x => x.id === kw.id ? { ...x, bidAmt: MIN_BID } : x));
      } else {
        toast.error('변경 실패');
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setProcessingId(null); }
  };

  const handleDelete = async (kw: ZeroKeyword) => {
    if (!confirm(`"${kw.keyword}" 키워드를 삭제하시겠습니까?`)) return;
    setProcessingId(kw.id);
    try {
      const r = await deleteKeyword(adAccountId, kw.id);
      if (r.error) { toast.error(`삭제 실패: ${r.error}`); }
      else {
        toast.success(`${kw.keyword} 삭제됨`);
        setZeroKws(prev => prev.filter(x => x.id !== kw.id));
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setProcessingId(null); }
  };

  const handleReplaceWith = async (kw: ZeroKeyword, newKeyword: string) => {
    if (!confirm(`"${kw.keyword}" 삭제 → "${newKeyword}" 등록하시겠습니까?`)) return;
    setProcessingId(kw.id);
    try {
      // 1. 새 키워드 등록
      const addRes = await addKeywords(adAccountId, kw.adGroupId, [{ keyword: newKeyword, bidAmt: kw.bidAmt }]);
      if (addRes.error) throw new Error(`등록 실패: ${addRes.error}`);
      // 2. 기존 삭제
      const delRes = await deleteKeyword(adAccountId, kw.id);
      if (delRes.error) throw new Error(`기존 삭제 실패: ${delRes.error}`);
      toast.success(`${kw.keyword} → ${newKeyword} 교체 완료`);
      setZeroKws(prev => prev.filter(x => x.id !== kw.id));
    } catch (e) { toast.error((e as Error).message); }
    finally { setProcessingId(null); }
  };

  // ====== 일괄 처리 — 검색량 없는 키워드 전부 MIN_BID로 ======
  const handleBulkLower = async () => {
    const targets = zeroKws.filter(k => k.monthlySearch < 100);
    if (targets.length === 0) { toast.info('검색량이 낮은 키워드가 없습니다'); return; }
    if (!confirm(`검색량 낮은 ${targets.length}개 키워드를 ${MIN_BID}원으로 조정합니다.`)) return;
    setBulkProcessing(true);
    let ok = 0, fail = 0;
    for (const t of targets) {
      try {
        const r = await updateKeywordBid(adAccountId, t.id, MIN_BID, t.adGroupId);
        if (r) ok++; else fail++;
      } catch { fail++; }
    }
    setZeroKws(prev => prev.map(k => targets.some(t => t.id === k.id) ? { ...k, bidAmt: MIN_BID } : k));
    toast.success(`일괄 처리 완료: ${ok}개 성공 / ${fail}개 실패`);
    setBulkProcessing(false);
  };

  // ====== 축소 배너 ======
  if (!modalOpen) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex items-center gap-3 shadow-sm">
        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[0.85rem] font-bold text-red-700">
            🔴 비효율 키워드 {zeroKws.length}개 감지
          </p>
          <p className="text-[0.75rem] text-red-600">
            7일간 노출 0회 · 예상 낭비 광고비 <strong>월 {estimatedWaste.toLocaleString()}원</strong>
          </p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="shrink-0 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700">
          지금 최적화 →
        </button>
      </div>
    );
  }

  // ====== 상세 모달 ======
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-600" />
              비효율 키워드 최적화
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {zeroKws.length}개 키워드 · 월 낭비 추정 {estimatedWaste.toLocaleString()}원
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkLower} disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50">
              {bulkProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              검색량 적은 키워드 일괄 {MIN_BID}원
            </button>
            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {zeroKws.map(kw => {
            const isProcessing = processingId === kw.id;
            const noSearch = kw.monthlySearch < 100;
            const rank1 = kw.estimates?.find(e => e.position === 1)?.bid || 0;
            const rank3 = kw.estimates?.find(e => e.position === 3)?.bid || 0;
            const rank5 = kw.estimates?.find(e => e.position === 5)?.bid || 0;

            const aiAdvice = noSearch
              ? '검색량이 거의 없는 키워드입니다. 입찰가를 낮추거나 유사 키워드로 교체하는 것이 광고비 절감에 효과적입니다.'
              : rank3 > 0 && kw.bidAmt < rank3
                ? `경쟁사 3위 입찰가(${rank3.toLocaleString()}원)보다 현재 입찰가가 낮아 노출되지 못하고 있습니다. 입찰가를 올리거나 더 낮은 순위(5~7위)를 목표로 설정하세요.`
                : '노출 요인을 분석 중입니다. [경쟁 입찰가 조회] 버튼을 눌러 정확한 진단을 받으세요.';

            return (
              <div key={kw.id} className="border border-red-200 rounded-xl p-4 bg-red-50/30">
                {/* 키워드 헤더 */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">🔴 {kw.keyword}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      현재 입찰가 <strong>{kw.bidAmt.toLocaleString()}원</strong> ·{' '}
                      {kw.monthlySearch > 0
                        ? `월 검색량 ${kw.monthlySearch.toLocaleString()}회`
                        : '검색량 매우 적음 / 데이터 없음'}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${noSearch ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>
                    {noSearch ? '검색량 부족' : '입찰가 부족 가능'}
                  </span>
                </div>

                {/* 경쟁 입찰가 */}
                <div className="bg-white rounded-lg border border-slate-200 p-2.5 mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-600">경쟁사 입찰가</span>
                    {!kw.estimates && !kw.loadingEst && (
                      <button onClick={() => loadEstimatesFor(kw.id)}
                        className="text-[10px] text-blue-600 hover:underline">조회</button>
                    )}
                    {kw.loadingEst && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                  </div>
                  {kw.estimates && kw.estimates.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div><span className="text-slate-400">1위</span> <span className="font-bold text-red-600">{rank1 > 0 ? `${rank1.toLocaleString()}원` : '없음'}</span></div>
                      <div><span className="text-slate-400">3위</span> <span className="font-bold text-orange-600">{rank3 > 0 ? `${rank3.toLocaleString()}원` : '없음'}</span></div>
                      <div><span className="text-slate-400">5위</span> <span className="font-bold text-blue-600">{rank5 > 0 ? `${rank5.toLocaleString()}원` : '없음'}</span></div>
                    </div>
                  ) : kw.estimates && kw.estimates.length === 0 ? (
                    <p className="text-[11px] text-slate-400">경쟁 입찰가 데이터 없음 (검색량 매우 적음)</p>
                  ) : null}
                </div>

                {/* AI 제안 */}
                <div className="bg-purple-50 rounded-lg p-2.5 mb-2 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-purple-900 leading-relaxed flex-1">{aiAdvice}</p>
                </div>

                {/* 유사 키워드 추천 */}
                {kw.suggestions && kw.suggestions.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-2.5 mb-2">
                    <p className="text-[11px] font-semibold text-blue-900 mb-1.5">💡 교체 추천 키워드</p>
                    <div className="space-y-1">
                      {kw.suggestions.map(s => (
                        <div key={s.keyword} className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-700 truncate">
                            → <strong>{s.keyword}</strong>
                            <span className="text-slate-400 ml-1">(월 {s.monthlyTotal.toLocaleString()}회)</span>
                          </span>
                          <button onClick={() => handleReplaceWith(kw, s.keyword)}
                            disabled={isProcessing}
                            className="shrink-0 px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-medium hover:bg-blue-700 disabled:opacity-50">
                            교체
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleLowerBid(kw)} disabled={isProcessing || kw.bidAmt <= MIN_BID}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-[11px] font-medium hover:bg-green-700 disabled:opacity-50">
                    {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    입찰가 {MIN_BID}원으로 낮추기
                  </button>
                  {!kw.suggestions && (
                    <button onClick={() => loadSuggestionsFor(kw.id)} disabled={kw.loadingSug || isProcessing}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-500 text-blue-600 rounded-lg text-[11px] font-medium hover:bg-blue-50 disabled:opacity-50">
                      {kw.loadingSug ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                      유사 키워드 추천
                    </button>
                  )}
                  <button onClick={() => handleDelete(kw)} disabled={isProcessing}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-400 text-red-600 rounded-lg text-[11px] font-medium hover:bg-red-50 disabled:opacity-50">
                    <Trash2 className="w-3 h-3" />
                    이 키워드 삭제
                  </button>
                </div>
              </div>
            );
          })}

          {zeroKws.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-12">
              ✅ 모든 비효율 키워드가 처리되었습니다
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
          <span>💡 노출 0회 기준 최근 7일 · 월 낭비 광고비는 추정치</span>
          {onNavigate && (
            <button onClick={() => { setModalOpen(false); onNavigate('keywords'); }}
              className="text-blue-600 hover:underline font-medium">
              키워드 탭에서 전체 관리 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
