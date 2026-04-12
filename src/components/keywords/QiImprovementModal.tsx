import { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { fetchAds, fetchAdExtensions } from '@/lib/naverApi';

interface Props {
  keyword: string;
  currentGrade: number;
  adAccountId: string;
  adGroupId: string;
  onClose: () => void;
}

interface AdItem {
  nccAdId: string;
  ad?: { headline?: string; description?: string };
  assets?: { assetData: { text: string }; linkType: string }[];
}

interface ExtItem {
  nccAdExtensionId: string;
  type: string;
}

type CheckStatus = 'ok' | 'warn' | 'loading';

function CheckRow({ status, label, detail, action }: { status: CheckStatus; label: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
      status === 'ok' ? 'bg-green-50' : status === 'warn' ? 'bg-orange-50' : 'bg-gray-50'
    }`}>
      <span className="shrink-0 mt-0.5">
        {status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
         status === 'warn' ? <AlertTriangle className="w-4 h-4 text-orange-500" /> :
         <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        {detail && <p className="text-[11px] text-muted-foreground mt-0.5">{detail}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default function QiImprovementModal({ keyword, currentGrade, adAccountId, adGroupId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [extensions, setExtensions] = useState<ExtItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [adData, extData] = await Promise.all([
          fetchAds(adAccountId, adGroupId),
          fetchAdExtensions(adAccountId, adGroupId).catch(() => []),
        ]);
        if (cancelled) return;
        setAds((adData as AdItem[]) || []);
        setExtensions((extData as ExtItem[]) || []);
      } catch {
        if (!cancelled) { setAds([]); setExtensions([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [adAccountId, adGroupId]);

  const getAdTexts = (ad: AdItem) => {
    const h: string[] = [], d: string[] = [];
    if (ad.assets) {
      for (const a of ad.assets) {
        if (a.linkType === 'HEADLINE') h.push(a.assetData.text);
        if (a.linkType === 'DESCRIPTION') d.push(a.assetData.text);
      }
    }
    if (ad.ad?.headline) h.push(ad.ad.headline);
    if (ad.ad?.description) d.push(ad.ad.description);
    return { headlines: h, descs: d };
  };

  const headlineIncludes = ads.some(ad => {
    const { headlines } = getAdTexts(ad);
    return headlines.some(h => h.includes(keyword));
  });
  const descIncludes = ads.some(ad => {
    const { descs } = getAdTexts(ad);
    return descs.some(d => d.includes(keyword));
  });
  const adCount = ads.length;
  const adCountOk = adCount >= 3;

  const hasPhone = extensions.some(e => e.type === 'PHONE');
  const hasSublink = extensions.some(e => e.type === 'SUBLINK');
  const hasPromotion = extensions.some(e => e.type === 'PROMOTION' || e.type === 'DESCRIPTION');

  const goToAdsTab = () => {
    // 부드럽게 닫고 탭 전환 이벤트 발행 (전역 핸들러 없으면 그냥 닫기)
    try { window.dispatchEvent(new CustomEvent('hitad:switchTab', { detail: 'ads' })); } catch { /* skip */ }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-yellow-50 to-orange-50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="font-bold text-foreground">품질지수 개선 방법</h3>
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{keyword}</span> · 현재 {currentGrade}칸 → 목표 7칸 이상
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/50"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* 즉시 할 수 있는 것 */}
          <section>
            <h4 className="text-xs font-bold text-foreground mb-2">즉시 할 수 있는 것</h4>
            <div className="space-y-1.5">
              {loading ? (
                <CheckRow status="loading" label="소재 정보 조회 중..." />
              ) : (
                <>
                  <CheckRow
                    status={headlineIncludes ? 'ok' : 'warn'}
                    label="소재 제목에 키워드 포함"
                    detail={headlineIncludes
                      ? `"${keyword}"이(가) 소재 제목에 포함되어 있습니다`
                      : `제목에 "${keyword}" 포함 시 품질지수가 올라갑니다`}
                    action={!headlineIncludes && (
                      <button onClick={goToAdsTab} className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">소재 수정</button>
                    )}
                  />
                  <CheckRow
                    status={descIncludes ? 'ok' : 'warn'}
                    label="소재 설명에 키워드 포함"
                    detail={descIncludes
                      ? `"${keyword}"이(가) 설명문구에 포함되어 있습니다`
                      : `설명문구(45자)에 "${keyword}" 포함을 권장`}
                    action={!descIncludes && (
                      <button onClick={goToAdsTab} className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">소재 수정</button>
                    )}
                  />
                  <CheckRow
                    status={adCountOk ? 'ok' : 'warn'}
                    label="소재 3개 이상 등록"
                    detail={`현재 ${adCount}개 등록됨 ${adCountOk ? '' : `· ${3 - adCount}개 더 필요`}`}
                    action={!adCountOk && (
                      <button onClick={goToAdsTab} className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">소재 탭으로 이동</button>
                    )}
                  />
                </>
              )}
            </div>
          </section>

          {/* 랜딩페이지 개선 */}
          <section>
            <h4 className="text-xs font-bold text-foreground mb-2">랜딩페이지 개선</h4>
            <div className="space-y-1.5">
              <CheckRow
                status="warn"
                label="viphome.kr 품질 체크"
                detail="랜딩페이지의 제목/본문에 키워드가 포함되어 있는지 확인하세요"
                action={(
                  <button
                    onClick={() => alert('페이지 분석 기능은 준비 중입니다.')}
                    className="px-2 py-1 text-[10px] bg-slate-600 text-white rounded hover:bg-slate-700 whitespace-nowrap">
                    페이지 분석
                  </button>
                )}
              />
            </div>
          </section>

          {/* 확장소재 현황 */}
          <section>
            <h4 className="text-xs font-bold text-foreground mb-2">확장소재 현황</h4>
            <div className="space-y-1.5">
              {loading ? (
                <CheckRow status="loading" label="확장소재 조회 중..." />
              ) : (
                <>
                  <CheckRow
                    status={hasPhone ? 'ok' : 'warn'}
                    label="전화번호"
                    detail={hasPhone ? '등록됨' : '전화번호 확장소재 등록을 권장'}
                    action={!hasPhone && (
                      <button onClick={goToAdsTab} className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">추가</button>
                    )}
                  />
                  <CheckRow
                    status={hasSublink ? 'ok' : 'warn'}
                    label="서브링크"
                    detail={hasSublink ? '등록됨' : '모델하우스/상담 등 서브링크 등록 권장'}
                    action={!hasSublink && (
                      <button onClick={goToAdsTab} className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">추가</button>
                    )}
                  />
                  <CheckRow
                    status={hasPromotion ? 'ok' : 'warn'}
                    label="홍보문구"
                    detail={hasPromotion ? '등록됨' : '이벤트/혜택 홍보문구 등록 권장'}
                    action={!hasPromotion && (
                      <button onClick={goToAdsTab} className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">추가</button>
                    )}
                  />
                </>
              )}
            </div>
          </section>
        </div>

        <div className="px-5 py-3 border-t bg-muted/20 text-center">
          <button onClick={onClose} className="px-4 py-1.5 text-xs border rounded-lg hover:bg-muted/50">닫기</button>
        </div>
      </div>
    </div>
  );
}
