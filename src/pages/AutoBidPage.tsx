import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Zap,
  Eye,
  Lock,
  Pencil,
  Trash2,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { UpgradePrompt } from '@/components/ui/UpgradePrompt';
import { workerFetch } from '@/lib/api';
import { useSite } from '@/contexts/SiteContext';
import { usePlan } from '@/hooks/usePlan';
import { Download } from 'lucide-react';

type Tab = 'keywords' | 'logs';

interface KeywordStat {
  keyword: string;
  keyword_id?: string;
  current_rank: number | null;
  current_bid: number;
  target_rank: number | null;
  max_bid?: number;
  min_bid?: number;
  bid_setting_id?: number | null;
  is_active?: number;
  strategy?: string;
}

interface BidLog {
  id: number;
  created_at: string;
  keyword: string;
  prev_bid: number;
  new_bid: number;
  current_rank: number | null;
  target_rank: number | null;
  strategy: string;
  reason?: string;
}

interface OptimizerResultItem {
  keyword: string;
  current_bid: number;
  new_bid: number;
  current_rank: number | null;
  target_rank: number | null;
  action: 'raise' | 'lower' | 'skip' | 'keep';
  reason?: string;
}

interface OptimizerResponse {
  results?: OptimizerResultItem[];
  changed?: number;
  kept?: number;
  skipped?: number;
}

const won = (n: number) => `₩${(n ?? 0).toLocaleString()}`;

function getStatus(kw: KeywordStat): { label: string; cls: string } {
  if (kw.max_bid && kw.current_bid >= kw.max_bid)
    return { label: '최대도달', cls: 'bg-red-50 text-red-600 border-red-200' };
  if (kw.current_rank == null)
    return { label: '노출없음', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (kw.target_rank == null)
    return { label: '미설정', cls: 'bg-gray-50 text-gray-500 border-gray-200' };
  if (kw.current_rank === kw.target_rank)
    return { label: '목표달성', cls: 'bg-green-50 text-green-600 border-green-200' };
  if (kw.current_rank < kw.target_rank)
    return { label: '하향입찰', cls: 'bg-gray-50 text-gray-600 border-gray-200' };
  return { label: '입찰중', cls: 'bg-blue-50 text-blue-600 border-blue-200' };
}

export function AutoBidPage() {
  const { siteId } = useSite();
  const { isFree } = usePlan();
  const [tab, setTab] = useState<Tab>('keywords');
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Keyword tab state
  const [keywords, setKeywords] = useState<KeywordStat[]>([]);
  const [loadingKw, setLoadingKw] = useState(false);
  const [running, setRunning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<OptimizerResponse | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<KeywordStat | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Logs tab state
  const [logs, setLogs] = useState<BidLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadKeywords = async () => {
    if (!siteId) return;
    setLoadingKw(true);
    try {
      const data = await workerFetch<{ keywords?: KeywordStat[] } | KeywordStat[]>(
        `/naver/keyword-stats?site_id=${siteId}`,
      );
      const list = Array.isArray(data) ? data : data?.keywords ?? [];
      setKeywords(list);
    } catch (e) {
      console.error('keyword-stats load failed', e);
      setKeywords([]);
    } finally {
      setLoadingKw(false);
    }
  };

  const loadLogs = async () => {
    if (!siteId) return;
    setLoadingLogs(true);
    try {
      const data = await workerFetch<{ logs?: BidLog[] } | BidLog[]>(
        `/naver/bid-logs?site_id=${siteId}&limit=50`,
      );
      const list = Array.isArray(data) ? data : data?.logs ?? [];
      setLogs(list);
    } catch (e) {
      console.error('bid-logs load failed', e);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (!siteId) return;
    if (tab === 'keywords') loadKeywords();
    if (tab === 'logs') loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, siteId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const runOptimizer = async (dryRun: boolean) => {
    // Free 플랜은 미리보기(dryRun)만 허용
    if (isFree && !dryRun) {
      setShowUpgrade(true);
      return;
    }
    const setLoading = dryRun ? setPreviewing : setRunning;
    setLoading(true);
    try {
      const res = await workerFetch<OptimizerResponse>('/naver/run-optimizer', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          strategy: 'target_rank',
          settings: { targetRank: 3, maxBid: 3000, dryRun, maxKeywords: 50 },
        }),
      });
      if (dryRun) {
        setPreviewResult(res);
      } else {
        const n = res.changed ?? res.results?.filter((r) => r.action !== 'skip' && r.action !== 'keep').length ?? 0;
        showToast(`${n}개 키워드 입찰가 조정 완료`);
        await loadKeywords();
      }
    } catch (e: any) {
      showToast(`실패: ${e?.message ?? '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const applyPreview = async () => {
    setPreviewResult(null);
    await runOptimizer(false);
  };

  const toggleActive = async (kw: KeywordStat) => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    if (!kw.bid_setting_id) return;
    const next = kw.is_active ? 0 : 1;
    setKeywords((prev) =>
      prev.map((k) => (k.bid_setting_id === kw.bid_setting_id ? { ...k, is_active: next } : k)),
    );
    try {
      await workerFetch(`/naver/bid-settings/${kw.bid_setting_id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: next }),
      });
    } catch (e) {
      showToast('상태 변경 실패');
      loadKeywords();
    }
  };

  const deleteSetting = async (kw: KeywordStat) => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    if (!kw.bid_setting_id) return;
    if (!confirm(`"${kw.keyword}" 자동입찰 설정을 삭제하시겠습니까?`)) return;
    try {
      await workerFetch(`/naver/bid-settings/${kw.bid_setting_id}`, { method: 'DELETE' });
      showToast('삭제 완료');
      loadKeywords();
    } catch (e: any) {
      showToast(`삭제 실패: ${e?.message ?? ''}`);
    }
  };

  const bulkImport = async () => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    if (!siteId || keywords.length === 0) return;
    const targets = keywords.filter((k) => !k.bid_setting_id);
    if (targets.length === 0) {
      showToast('이미 모든 키워드가 등록되어 있습니다');
      return;
    }
    setBulkProgress({ done: 0, total: targets.length });
    let done = 0;
    const tasks = targets.map(async (kw) => {
      try {
        await workerFetch('/naver/bid-settings', {
          method: 'POST',
          body: JSON.stringify({
            site_id: siteId,
            keyword: kw.keyword,
            keyword_id: kw.keyword_id ?? `manual_${kw.keyword}`,
            target_rank: 3,
            max_bid: 3000,
            min_bid: 70,
            strategy: 'target_rank',
            is_active: 1,
          }),
        });
      } catch {
        /* ignore individual failures */
      } finally {
        done += 1;
        setBulkProgress({ done, total: targets.length });
      }
    });
    await Promise.allSettled(tasks);
    setBulkProgress(null);
    showToast(`${done}개 키워드 등록 완료`);
    loadKeywords();
  };

  const todaySummary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todays = logs.filter((l) => (l.created_at ?? '').slice(0, 10) === today);
    let saved = 0;
    let raised = 0;
    for (const l of todays) {
      const d = (l.new_bid ?? 0) - (l.prev_bid ?? 0);
      if (d > 0) raised += d;
      else if (d < 0) saved += -d;
    }
    return { count: todays.length, saved, raised };
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {[
          { id: 'keywords' as const, label: '키워드 관리' },
          { id: 'logs' as const, label: '입찰 이력' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isFree && (
        <div className="bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">자동입찰은 Starter 플랜부터 사용할 수 있습니다</h4>
              <p className="text-sm text-gray-600 mt-0.5">
                키워드 50개까지 24시간 자동 관리. CPA 목표 기반 AI 입찰 최적화.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUpgrade(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0"
          >
            업그레이드
          </button>
        </div>
      )}

      {tab === 'keywords' ? (
        <KeywordsTab
          keywords={keywords}
          loading={loadingKw}
          running={running}
          previewing={previewing}
          isFree={isFree}
          bulkProgress={bulkProgress}
          onBulkImport={bulkImport}
          onAdd={() => (isFree ? setShowUpgrade(true) : setShowAdd(true))}
          onRun={() => runOptimizer(false)}
          onPreview={() => runOptimizer(true)}
          onEdit={(kw) => (isFree ? setShowUpgrade(true) : setEditTarget(kw))}
          onDelete={deleteSetting}
          onToggle={toggleActive}
        />
      ) : (
        <LogsTab
          logs={logs}
          loading={loadingLogs}
          summary={todaySummary}
          isFree={isFree}
          onUpgrade={() => setShowUpgrade(true)}
        />
      )}

      {/* Add modal */}
      {showAdd && (
        <KeywordFormModal
          mode="add"
          siteId={siteId}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            loadKeywords();
            showToast('키워드 추가 완료');
          }}
          existingKeywords={keywords}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <KeywordFormModal
          mode="edit"
          initial={editTarget}
          siteId={siteId}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            loadKeywords();
            showToast('수정 완료');
          }}
        />
      )}

      {/* Preview modal */}
      {previewResult && (
        <PreviewModal
          result={previewResult}
          onClose={() => setPreviewResult(null)}
          onApply={applyPreview}
          applying={running}
        />
      )}

      {showUpgrade && (
        <UpgradePrompt
          feature="자동입찰"
          description="자동입찰은 Starter 플랜부터 사용할 수 있습니다. 지금 업그레이드하면 키워드 50개까지 24시간 자동 관리됩니다."
          onClose={() => setShowUpgrade(false)}
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

/* ---------- Keywords Tab ---------- */

function KeywordsTab(props: {
  keywords: KeywordStat[];
  loading: boolean;
  running: boolean;
  previewing: boolean;
  isFree: boolean;
  bulkProgress: { done: number; total: number } | null;
  onBulkImport: () => void;
  onAdd: () => void;
  onRun: () => void;
  onPreview: () => void;
  onEdit: (kw: KeywordStat) => void;
  onDelete: (kw: KeywordStat) => void;
  onToggle: (kw: KeywordStat) => void;
}) {
  const { keywords, loading, running, previewing, isFree, bulkProgress, onBulkImport, onAdd, onRun, onPreview, onEdit, onDelete, onToggle } = props;

  return (
    <div className="space-y-4">
      {isFree && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <Eye className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 leading-relaxed">
            현재 광고 현황을 확인하고 있습니다.
            <br />
            <span className="text-blue-700">자동입찰을 실행하려면 Starter 플랜으로 업그레이드하세요.</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        {/* Action bar */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold text-gray-900">키워드 자동입찰 ({keywords.length}개)</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onPreview}
              disabled={previewing}
              className="flex items-center gap-1.5 text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              미리보기
            </button>
            <button
              onClick={onRun}
              disabled={running}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-50 ${
                isFree
                  ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isFree ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              지금 실행
            </button>
            <button
              onClick={onBulkImport}
              disabled={!!bulkProgress || keywords.length === 0}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-50 ${
                isFree
                  ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  : 'bg-violet-600 text-white hover:bg-violet-700'
              }`}
              title="네이버에서 가져온 모든 키워드를 자동입찰에 일괄 등록"
            >
              {bulkProgress ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isFree ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {bulkProgress ? `등록 중... ${bulkProgress.done}/${bulkProgress.total}` : '전체 불러오기'}
            </button>
            <button
              onClick={onAdd}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg ${
                isFree
                  ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isFree ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              키워드 추가
            </button>
          </div>
        </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
          불러오는 중...
        </div>
      ) : keywords.length === 0 ? (
        <div className="p-12 text-center text-sm text-gray-400">
          등록된 키워드가 없습니다. "키워드 추가"로 시작하세요.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 font-medium">키워드</th>
                <th className="px-3 py-3 font-medium text-center">현재순위</th>
                <th className="px-3 py-3 font-medium text-center">목표순위</th>
                <th className="px-3 py-3 font-medium text-right">현재입찰가</th>
                <th className="px-3 py-3 font-medium text-center">상태</th>
                <th className="px-3 py-3 font-medium text-center">ON/OFF</th>
                <th className="px-3 py-3 font-medium text-center">액션</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw, i) => {
                const status = getStatus(kw);
                const hasSetting = !!kw.bid_setting_id;
                const isActive = !!kw.is_active;
                return (
                  <tr key={`${kw.keyword}-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{kw.keyword}</td>
                    <td className="px-3 py-3 text-center text-gray-700">
                      {kw.current_rank == null ? (
                        <span className="text-gray-400">노출없음</span>
                      ) : (
                        `${kw.current_rank}위`
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {kw.target_rank == null ? (
                        <span className="text-gray-300">-</span>
                      ) : (
                        <span className="text-gray-600">{kw.target_rank}위</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{won(kw.current_bid)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[10px] font-medium px-2 py-1 rounded-full border ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {hasSetting ? (
                        <button
                          onClick={() => onToggle(kw)}
                          title={isFree ? '자동입찰은 Starter부터' : ''}
                          className={`relative inline-flex items-center w-9 h-5 rounded-full transition-colors ${
                            isFree ? 'bg-gray-300 cursor-not-allowed' : isActive ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block w-3.5 h-3.5 bg-white rounded-full shadow transform transition-transform ${
                              !isFree && isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'
                            }`}
                          />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => onEdit(kw)}
                          className={`p-1.5 rounded ${
                            isFree
                              ? 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                              : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title={isFree ? '자동입찰은 Starter부터' : '수정'}
                        >
                          {isFree ? <Lock className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                        </button>
                        {hasSetting && (
                          <button
                            onClick={() => onDelete(kw)}
                            className={`p-1.5 rounded ${
                              isFree
                                ? 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={isFree ? '자동입찰은 Starter부터' : '삭제'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}

/* ---------- Logs Tab ---------- */

function LogsTab(props: {
  logs: BidLog[];
  loading: boolean;
  summary: { count: number; saved: number; raised: number };
  isFree: boolean;
  onUpgrade: () => void;
}) {
  const { logs, loading, summary, isFree, onUpgrade } = props;
  const visibleLogs = isFree ? logs.slice(0, 3) : logs;
  const blurredLogs = isFree ? logs.slice(3, 8) : [];

  const cards = [
    { label: '오늘 조정 건수', value: `${summary.count}건`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '오늘 절감 금액', value: won(summary.saved), icon: TrendingDown, color: 'text-green-600', bg: 'bg-green-50' },
    { label: '오늘 상향 금액', value: won(summary.raised), icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mt-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">입찰 변경 이력</h3>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            불러오는 중...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">아직 입찰 변경 이력이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 font-medium">시간</th>
                  <th className="px-3 py-3 font-medium">키워드</th>
                  <th className="px-3 py-3 font-medium text-right">이전</th>
                  <th className="px-3 py-3 font-medium text-right">신규</th>
                  <th className="px-3 py-3 font-medium text-right">변경액</th>
                  <th className="px-3 py-3 font-medium text-center">순위</th>
                  <th className="px-3 py-3 font-medium">전략</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((l) => {
                  const delta = (l.new_bid ?? 0) - (l.prev_bid ?? 0);
                  const up = delta > 0;
                  const down = delta < 0;
                  return (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {(l.created_at ?? '').replace('T', ' ').slice(0, 16)}
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-800">{l.keyword}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{won(l.prev_bid)}</td>
                      <td className="px-3 py-3 text-right text-gray-900 font-semibold">{won(l.new_bid)}</td>
                      <td
                        className={`px-3 py-3 text-right font-semibold ${
                          up ? 'text-red-600' : down ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {up ? '+' : ''}
                        {won(delta).replace('₩', delta < 0 ? '-₩' : '₩').replace('-₩-', '-₩')}
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">
                        {l.current_rank ?? '-'}위 → {l.target_rank ?? '-'}위
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{l.strategy}</td>
                    </tr>
                  );
                })}
                {isFree &&
                  blurredLogs.map((l) => (
                    <tr key={`blur-${l.id}`} className="border-b border-gray-50" style={{ filter: 'blur(4px)', userSelect: 'none' }}>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {(l.created_at ?? '').replace('T', ' ').slice(0, 16)}
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-800">{l.keyword}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{won(l.prev_bid)}</td>
                      <td className="px-3 py-3 text-right text-gray-900 font-semibold">{won(l.new_bid)}</td>
                      <td className="px-3 py-3 text-right text-gray-500">-</td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">-</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{l.strategy}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {isFree && logs.length > 3 && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gradient-to-r from-blue-50 to-violet-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Lock className="w-4 h-4 text-blue-600" />
              전체 이력은 Starter 플랜부터 확인할 수 있습니다
            </div>
            <button
              onClick={onUpgrade}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
            >
              업그레이드
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- Keyword Add/Edit Modal ---------- */

function KeywordFormModal(props: {
  mode: 'add' | 'edit';
  initial?: KeywordStat;
  existingKeywords?: KeywordStat[];
  siteId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mode, initial, existingKeywords, siteId, onClose, onSaved } = props;
  const [keywordsText, setKeywordsText] = useState(initial?.keyword ?? '');
  const [targetRank, setTargetRank] = useState<number>(initial?.target_rank ?? 3);
  const [maxBid, setMaxBid] = useState<number>(initial?.max_bid ?? 3000);
  const [minBid, setMinBid] = useState<number>(initial?.min_bid ?? 70);
  const [strategy, setStrategy] = useState<string>(initial?.strategy ?? 'target_rank');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      if (mode === 'edit' && initial?.bid_setting_id) {
        await workerFetch(`/naver/bid-settings/${initial.bid_setting_id}`, {
          method: 'PUT',
          body: JSON.stringify({
            target_rank: targetRank,
            max_bid: maxBid,
            min_bid: minBid,
            strategy,
          }),
        });
      } else {
        const list = keywordsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        if (list.length === 0) throw new Error('키워드를 1개 이상 입력하세요');
        for (const kw of list) {
          const found = existingKeywords?.find((k) => k.keyword === kw);
          await workerFetch('/naver/bid-settings', {
            method: 'POST',
            body: JSON.stringify({
              site_id: siteId,
              keyword: kw,
              keyword_id: found?.keyword_id ?? `manual_${kw}`,
              target_rank: targetRank,
              max_bid: maxBid,
              min_bid: minBid,
              strategy,
              is_active: 1,
            }),
          });
        }
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold text-gray-900 mb-5">
          {mode === 'add' ? '키워드 추가' : `"${initial?.keyword}" 설정 수정`}
        </h3>

        <div className="space-y-4">
          {mode === 'add' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                키워드 (여러 개는 줄바꿈으로 구분)
              </label>
              <textarea
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                rows={5}
                placeholder={'송도분양\n송도아파트\n송도잔여세대'}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">목표 순위</label>
              <select
                value={targetRank}
                onChange={(e) => setTargetRank(Number(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}위
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">전략</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="target_rank">목표순위 유지</option>
                <option value="max_efficiency">최대 효율</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">최대 입찰가 (원)</label>
              <input
                type="number"
                value={maxBid}
                onChange={(e) => setMaxBid(Number(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">최소 입찰가 (원)</label>
              <input
                type="number"
                value={minBid}
                onChange={(e) => setMinBid(Number(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
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
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'add' ? '추가' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Preview Modal ---------- */

function PreviewModal(props: {
  result: OptimizerResponse;
  onClose: () => void;
  onApply: () => void;
  applying: boolean;
}) {
  const { result, onClose, onApply, applying } = props;
  const items = result.results ?? [];
  const changed = result.changed ?? items.filter((i) => i.action === 'raise' || i.action === 'lower').length;
  const kept = result.kept ?? items.filter((i) => i.action === 'keep').length;
  const skipped = result.skipped ?? items.filter((i) => i.action === 'skip').length;

  const rowBg = (a: OptimizerResultItem['action']) =>
    a === 'raise' ? 'bg-red-50/60' : a === 'lower' ? 'bg-green-50/60' : a === 'skip' ? 'bg-gray-50' : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">미리보기 결과</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {changed}개 변경 예정 · {kept}개 유지 · {skipped}개 스킵
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-auto flex-1">
          {items.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">변경 대상이 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs text-gray-400">
                  <th className="px-4 py-3 font-medium">키워드</th>
                  <th className="px-3 py-3 font-medium text-right">현재</th>
                  <th className="px-3 py-3 font-medium text-right">변경 후</th>
                  <th className="px-3 py-3 font-medium text-center">순위</th>
                  <th className="px-3 py-3 font-medium">사유</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const Icon =
                    it.action === 'raise' ? TrendingUp : it.action === 'lower' ? TrendingDown : Minus;
                  const iconCls =
                    it.action === 'raise'
                      ? 'text-red-600'
                      : it.action === 'lower'
                      ? 'text-green-600'
                      : 'text-gray-400';
                  return (
                    <tr key={i} className={`border-b border-gray-50 ${rowBg(it.action)}`}>
                      <td className="px-4 py-3 font-medium text-gray-800 flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${iconCls}`} />
                        {it.keyword}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">{won(it.current_bid)}</td>
                      <td className="px-3 py-3 text-right text-gray-900 font-semibold">{won(it.new_bid)}</td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">
                        {it.current_rank ?? '-'}위 → {it.target_rank ?? '-'}위
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{it.reason ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            닫기
          </button>
          <button
            onClick={onApply}
            disabled={applying || changed === 0}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {applying && <Loader2 className="w-4 h-4 animate-spin" />}
            실제 적용 ({changed}개)
          </button>
        </div>
      </div>
    </div>
  );
}
