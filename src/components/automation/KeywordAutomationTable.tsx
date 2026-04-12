import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  fetchCampaigns,
  fetchAdGroups,
  fetchKeywords,
  fetchKeywordStats,
  updateKeywordBid,
  type KeywordStatRow,
} from '@/lib/naverApi';
import type { NaverKeyword } from '@/lib/types';
import { Loader2, RefreshCw, Save, Check, Settings2, Play, PauseCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  adAccountId: string;
}

type Grade = 'S' | 'A' | 'B' | 'BRAND';

interface KeywordRow {
  nccKeywordId: string;
  nccAdgroupId: string;
  groupName: string;
  keyword: string;
  bidAmt: number;
  // 설정 (override)
  grade: Grade;
  targetRank: number;
  maxBid: number;
  minBid: number;
  realtimeEnabled: boolean;
  // 통계
  impCnt: number;
  clkCnt: number;
  cost: number;
  cpc: number;
  pcAvgRnk: number;
  mblAvgRnk: number;
  // 경쟁사 & 라이브 순위
  competitorRank1: number;
  liveRank: number;
  // dirty flag for per-row save
  dirty: boolean;
}

function getRankColor(rank: number, target: number): string {
  if (!rank || rank === 0) return 'text-slate-400';
  if (rank <= target) return 'text-green-600 font-bold';
  if (rank <= target + 2) return 'text-yellow-600';
  return 'text-red-600';
}

interface SettingRow {
  ncc_keyword_id: string;
  grade: string;
  target_rank: number;
  max_bid: number;
  min_bid: number;
  realtime_enabled: boolean;
}

const GRADE_DEFAULTS: Record<Grade, { targetRank: number; maxBid: number }> = {
  S:     { targetRank: 3, maxBid: 3000 },
  A:     { targetRank: 5, maxBid: 1500 },
  B:     { targetRank: 7, maxBid: 1000 },
  BRAND: { targetRank: 1, maxBid: 6000 },
};

export default function KeywordAutomationTable({ adAccountId }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<KeywordRow[]>([]);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkGrade, setBulkGrade] = useState<Grade>('A');
  const [bulkTargetRank, setBulkTargetRank] = useState<number | ''>('');
  const [bulkMaxBid, setBulkMaxBid] = useState<number | ''>('');
  const [realtimeMode, setRealtimeMode] = useState(true);
  const [running, setRunning] = useState(false);

  const loadData = useCallback(async () => {
    if (!adAccountId) return;
    setLoading(true);
    try {
      // 1. 캠페인 → 활성 광고그룹 전체
      const campaigns = await fetchCampaigns(adAccountId);
      const activeCamps = campaigns.filter(c => c.status === 'ELIGIBLE');
      const allGroups = (await Promise.all(
        activeCamps.map(c => fetchAdGroups(adAccountId, c.nccCampaignId))
      )).flat();

      // 2. 광고그룹별 키워드 fetch (직렬 — 부하 방지)
      const rawKeywords: { kw: NaverKeyword; group: string; gid: string }[] = [];
      for (const g of allGroups) {
        try {
          const kws = await fetchKeywords(adAccountId, g.nccAdgroupId);
          for (const kw of kws) rawKeywords.push({ kw, group: g.name, gid: g.nccAdgroupId });
        } catch { /* skip */ }
      }

      // 3. Stats 조회 (최근 7일 — fetchKeywordStats 가 내부에서 날짜/배치 처리)
      const allIds = rawKeywords.map(r => r.kw.nccKeywordId);
      const statsMap: Record<string, { imp: number; clk: number; cost: number; pcRnk: number; mblRnk: number; pcN: number; mblN: number }> = {};
      if (allIds.length > 0) {
        try {
          const stats = await fetchKeywordStats(adAccountId, allIds);
          for (const s of stats || []) {
            const id = s.id;
            if (!statsMap[id]) statsMap[id] = { imp: 0, clk: 0, cost: 0, pcRnk: 0, mblRnk: 0, pcN: 0, mblN: 0 };
            statsMap[id].imp += s.impCnt || 0;
            statsMap[id].clk += s.clkCnt || 0;
            statsMap[id].cost += s.salesAmt || 0;
            if ((s.avgRnk || 0) > 0) {
              // device 구분 필드는 응답에 따라 다름 — pc 로 합산 (stats API가 device 필드 미반환 시)
              const dv = (s as unknown as { device?: string }).device;
              if (dv === 'M' || dv === 'MOBILE') {
                statsMap[id].mblRnk += s.avgRnk; statsMap[id].mblN++;
              } else {
                statsMap[id].pcRnk += s.avgRnk; statsMap[id].pcN++;
              }
            }
          }
        } catch { /* skip */ }
      }

      // 4. Supabase ad_keyword_settings + competitor_bids + rank_logs 병렬 로드
      const since6h = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [overridesRes, compRes, rankRes] = await Promise.all([
        supabase.from('ad_keyword_settings').select('*').eq('ad_account_id', adAccountId),
        supabase.from('competitor_bids').select('keyword,bids,created_at').gte('created_at', since24h).order('created_at', { ascending: false }),
        supabase.from('rank_logs').select('keyword,rank,created_at').gte('created_at', since6h).order('created_at', { ascending: false }),
      ]);
      const overrideMap = new Map<string, SettingRow>();
      for (const s of ((overridesRes.data || []) as SettingRow[])) overrideMap.set(s.ncc_keyword_id, s);
      // competitor_bids: 키워드별 최신 1위
      const compMap = new Map<string, number>();
      for (const c of (compRes.data || [])) {
        if (!compMap.has(c.keyword)) {
          const r1 = (c.bids as Record<string, number> | null)?.['1'] || 0;
          if (r1 > 0) compMap.set(c.keyword, r1);
        }
      }
      // rank_logs: 키워드별 최신 라이브 순위
      const liveMap = new Map<string, number>();
      for (const r of (rankRes.data || [])) {
        if (!liveMap.has(r.keyword)) liveMap.set(r.keyword, r.rank);
      }

      // 5. rows 조립
      const nextRows: KeywordRow[] = rawKeywords.map(({ kw, group, gid }) => {
        // 그룹 이름 기반 기본 grade 추정
        const defaultGrade: Grade =
          group.includes('브랜드') ? 'BRAND' :
          group.startsWith('S') ? 'S' :
          group.startsWith('B') ? 'B' : 'A';
        const override = overrideMap.get(kw.nccKeywordId);
        const grade = (override?.grade as Grade) || defaultGrade;
        const defaults = GRADE_DEFAULTS[grade];
        const st = statsMap[kw.nccKeywordId];
        return {
          nccKeywordId: kw.nccKeywordId,
          nccAdgroupId: gid,
          groupName: group,
          keyword: kw.keyword,
          bidAmt: kw.bidAmt || 0,
          grade,
          targetRank: override?.target_rank ?? defaults.targetRank,
          maxBid: override?.max_bid ?? defaults.maxBid,
          minBid: override?.min_bid ?? 70,
          realtimeEnabled: override?.realtime_enabled ?? true,
          impCnt: st?.imp || 0,
          clkCnt: st?.clk || 0,
          cost: st?.cost || 0,
          cpc: st && st.clk > 0 ? Math.round(st.cost / st.clk) : 0,
          pcAvgRnk: st && st.pcN > 0 ? st.pcRnk / st.pcN : 0,
          mblAvgRnk: st && st.mblN > 0 ? st.mblRnk / st.mblN : 0,
          competitorRank1: compMap.get(kw.keyword) || 0,
          liveRank: liveMap.get(kw.keyword) ?? 0,
          dirty: false,
        };
      });
      setRows(nextRows);
    } catch (e) {
      toast.error(`키워드 로드 실패: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [adAccountId]);

  useEffect(() => { loadData(); }, [loadData]);

  // 개별 row 필드 수정
  const updateRow = (id: string, patch: Partial<KeywordRow>) => {
    setRows(prev => prev.map(r => r.nccKeywordId === id ? { ...r, ...patch, dirty: true } : r));
  };

  // 개별 저장 (supabase upsert + 필요 시 Naver bidAmt 업데이트)
  const saveRow = async (row: KeywordRow) => {
    if (!adAccountId) return;
    setSavingIds(prev => new Set(prev).add(row.nccKeywordId));
    try {
      const { error } = await supabase.from('ad_keyword_settings').upsert({
        ad_account_id: adAccountId,
        ncc_keyword_id: row.nccKeywordId,
        ncc_adgroup_id: row.nccAdgroupId,
        keyword: row.keyword,
        grade: row.grade,
        target_rank: row.targetRank,
        max_bid: row.maxBid,
        min_bid: row.minBid,
        realtime_enabled: row.realtimeEnabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ad_account_id,ncc_keyword_id' });
      if (error) throw error;

      // Naver 쪽 현재 입찰가가 max 초과면 클램프 (선택적 — 지금은 그냥 설정만 저장)
      if (row.bidAmt > row.maxBid) {
        await updateKeywordBid(adAccountId, row.nccKeywordId, row.maxBid, row.nccAdgroupId);
        toast.success(`${row.keyword}: 입찰가 ${row.maxBid}원으로 조정`);
      } else {
        toast.success(`${row.keyword} 설정 저장`);
      }
      setRows(prev => prev.map(r => r.nccKeywordId === row.nccKeywordId ? { ...r, dirty: false } : r));
    } catch (e) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(row.nccKeywordId); return n; });
    }
  };

  // 일괄 설정
  const applyBulk = async () => {
    if (checkedIds.size === 0) {
      toast.error('키워드를 먼저 선택하세요');
      return;
    }
    const defaults = GRADE_DEFAULTS[bulkGrade];
    setRows(prev => prev.map(r => {
      if (!checkedIds.has(r.nccKeywordId)) return r;
      return {
        ...r,
        grade: bulkGrade,
        targetRank: bulkTargetRank === '' ? defaults.targetRank : Number(bulkTargetRank),
        maxBid: bulkMaxBid === '' ? defaults.maxBid : Number(bulkMaxBid),
        dirty: true,
      };
    }));
    toast.success(`${checkedIds.size}개 키워드에 일괄 적용됨 — 개별 [저장] 또는 [전체저장]`);
    setShowBulkModal(false);
  };

  const saveAllDirty = async () => {
    const dirties = rows.filter(r => r.dirty);
    if (dirties.length === 0) { toast.info('변경사항 없음'); return; }
    for (const r of dirties) await saveRow(r);
    toast.success(`${dirties.length}개 저장 완료`);
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await fetch('https://viphome-bid-optimizer.noble-kclee.workers.dev/run');
      const json = await res.json();
      toast.success(`실행 완료: ${json.totalChanged}개 변경 / ${json.totalKeywords}개 키워드`);
    } catch (e) {
      toast.error(`실행 실패: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const totalCount = rows.length;
  const dirtyCount = rows.filter(r => r.dirty).length;
  const allChecked = totalCount > 0 && checkedIds.size === totalCount;

  return (
    <div className="space-y-3">
      {/* 상단 액션 바 */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">
          <button
            onClick={() => setRealtimeMode(true)}
            className={`px-2.5 py-1 text-xs rounded ${realtimeMode ? 'bg-[#093687] text-white font-bold' : 'text-slate-600'}`}
          >
            실시간입찰
          </button>
          <button
            onClick={() => setRealtimeMode(false)}
            className={`px-2.5 py-1 text-xs rounded ${!realtimeMode ? 'bg-[#093687] text-white font-bold' : 'text-slate-600'}`}
          >
            정기입찰
          </button>
        </div>

        <button
          onClick={() => setShowBulkModal(true)}
          disabled={checkedIds.size === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-40"
        >
          <Settings2 className="w-3.5 h-3.5" />
          선택 일괄설정 ({checkedIds.size})
        </button>

        <button
          onClick={saveAllDirty}
          disabled={dirtyCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#093687] text-white rounded-lg text-xs font-semibold hover:bg-[#072b6e] disabled:opacity-40"
        >
          <Save className="w-3.5 h-3.5" />
          전체 저장 ({dirtyCount})
        </button>

        <button
          onClick={runNow}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          지금 실행
        </button>

        <button
          onClick={loadData}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          새로고침
        </button>
      </div>

      {/* 키워드 테이블 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 sticky top-0">
              <tr>
                <th className="px-2 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={e => setCheckedIds(e.target.checked ? new Set(rows.map(r => r.nccKeywordId)) : new Set())}
                  />
                </th>
                <th className="px-2 py-2 w-10 text-center">No</th>
                <th className="px-2 py-2 w-20 text-left">등급</th>
                <th className="px-2 py-2 text-left">키워드 / 그룹</th>
                <th className="px-2 py-2 w-16 text-center">목표</th>
                <th className="px-2 py-2 w-24 text-right">최대입찰</th>
                <th className="px-2 py-2 w-24 text-right">현재입찰</th>
                <th className="px-2 py-2 w-24 text-right text-blue-600">경쟁사1위</th>
                <th className="px-2 py-2 w-16 text-center">PC순위</th>
                <th className="px-2 py-2 w-16 text-center">MO순위</th>
                <th className="px-2 py-2 w-14 text-center" title="실시간 rank_logs">라이브</th>
                <th className="px-2 py-2 w-20 text-right">노출</th>
                <th className="px-2 py-2 w-16 text-right">클릭</th>
                <th className="px-2 py-2 w-16 text-right">CPC</th>
                <th className="px-2 py-2 w-20 text-center">저장</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={15} className="py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />키워드/통계/경쟁사 로딩 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={15} className="py-8 text-center text-slate-400">키워드 없음</td></tr>
              ) : (
                rows.map((r, i) => {
                  const over = r.bidAmt >= r.maxBid;
                  const saving = savingIds.has(r.nccKeywordId);
                  return (
                    <tr key={r.nccKeywordId} className={`border-t border-slate-100 hover:bg-slate-50/50 ${r.dirty ? 'bg-yellow-50/40' : ''}`}>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={checkedIds.has(r.nccKeywordId)}
                          onChange={e => {
                            setCheckedIds(prev => {
                              const n = new Set(prev);
                              if (e.target.checked) n.add(r.nccKeywordId); else n.delete(r.nccKeywordId);
                              return n;
                            });
                          }}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center text-slate-400">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <select
                          value={r.grade}
                          onChange={e => updateRow(r.nccKeywordId, { grade: e.target.value as Grade })}
                          className="w-full px-1 py-0.5 border border-slate-200 rounded text-[11px]"
                        >
                          <option value="S">S등급</option>
                          <option value="A">A등급</option>
                          <option value="B">B등급</option>
                          <option value="BRAND">브랜드</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5 truncate max-w-[180px] text-slate-800 font-medium" title={`${r.keyword} · ${r.groupName}`}>
                        {r.keyword}
                        <div className="text-[9px] text-slate-400 truncate">{r.groupName}</div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={r.targetRank}
                          onChange={e => updateRow(r.nccKeywordId, { targetRank: Number(e.target.value) })}
                          className="w-14 px-1 py-0.5 border border-slate-200 rounded text-[11px] text-center"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          min={70}
                          step={10}
                          value={r.maxBid}
                          onChange={e => updateRow(r.nccKeywordId, { maxBid: Number(e.target.value) })}
                          className="w-20 px-1 py-0.5 border border-slate-200 rounded text-[11px] text-right tabular-nums"
                        />
                      </td>
                      <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${over ? 'text-red-600' : 'text-slate-700'}`}>
                        {r.bidAmt.toLocaleString()}원
                      </td>
                      <td className="px-2 py-1.5 text-right text-blue-600 tabular-nums font-medium">
                        {r.competitorRank1 > 0 ? `${r.competitorRank1.toLocaleString()}원` : '-'}
                      </td>
                      <td className={`px-2 py-1.5 text-center tabular-nums ${getRankColor(r.pcAvgRnk, r.targetRank)}`}>
                        {r.pcAvgRnk > 0 ? `${r.pcAvgRnk.toFixed(1)}위` : '-'}
                      </td>
                      <td className={`px-2 py-1.5 text-center tabular-nums ${getRankColor(r.mblAvgRnk, r.targetRank)}`}>
                        {r.mblAvgRnk > 0 ? `${r.mblAvgRnk.toFixed(1)}위` : '-'}
                      </td>
                      <td className={`px-2 py-1.5 text-center tabular-nums text-[11px] ${r.liveRank === 0 ? 'text-blue-500' : getRankColor(r.liveRank, r.targetRank)}`}>
                        {r.liveRank === 0 ? '조정중' : `${r.liveRank}위`}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{r.impCnt.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{r.clkCnt.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{r.cpc ? `${r.cpc.toLocaleString()}` : '-'}</td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => saveRow(r)}
                          disabled={!r.dirty || saving}
                          className="px-2 py-1 text-[10px] bg-[#093687] text-white rounded hover:bg-[#072b6e] disabled:opacity-30 disabled:bg-slate-300"
                          title={r.dirty ? '개별 저장' : '변경사항 없음'}
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : r.dirty ? '개별변경' : <Check className="w-3 h-3" />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 일괄설정 모달 */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowBulkModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-800 mb-3">선택 키워드 일괄설정 ({checkedIds.size}개)</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">등급</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['S', 'A', 'B', 'BRAND'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => setBulkGrade(g)}
                      className={`py-1.5 text-xs rounded border ${bulkGrade === g ? 'bg-[#093687] text-white border-[#093687] font-bold' : 'bg-white border-slate-200'}`}
                    >
                      {g === 'BRAND' ? '브랜드' : `${g}등급`}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  기본: 목표 {GRADE_DEFAULTS[bulkGrade].targetRank}위 / max {GRADE_DEFAULTS[bulkGrade].maxBid.toLocaleString()}원
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">목표순위 (비우면 기본)</label>
                  <input
                    type="number"
                    min={1} max={15}
                    value={bulkTargetRank}
                    onChange={e => setBulkTargetRank(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">최대입찰가 (비우면 기본)</label>
                  <input
                    type="number"
                    min={70} step={10}
                    value={bulkMaxBid}
                    onChange={e => setBulkMaxBid(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowBulkModal(false)} className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
              <button onClick={applyBulk} className="flex-1 px-3 py-2 text-xs bg-[#093687] text-white rounded-lg font-bold hover:bg-[#072b6e]">적용</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
