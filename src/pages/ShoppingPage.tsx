import { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag, Loader2, Zap, Search, Monitor, Smartphone, Lock, RefreshCw,
  TrendingUp, CircleDollarSign, Target, MousePointerClick,
} from 'lucide-react';
import { workerFetch } from '@/lib/api';
import { useSite } from '@/contexts/SiteContext';
import { usePlan } from '@/hooks/usePlan';
import { UpgradePrompt } from '@/components/ui/UpgradePrompt';

interface ShoppingGroup {
  group_id: string;
  group_name: string;
  campaign_id?: string;
  campaign_name?: string;
}

interface ShoppingItem {
  product_id?: string;
  product_name: string;
  campaign_id?: string;
  group_id?: string;
  rank_pc?: number | null;
  rank_mobile?: number | null;
  current_bid: number;
  bid_rank1?: number | null;
  bid_rank3?: number | null;
  roas?: number | null;
  is_active?: number;
  bid_setting_id?: number | null;
}

interface ShoppingStats {
  totals?: {
    cost?: number;
    clicks?: number;
    conversions?: number;
    revenue?: number;
    roas?: number;
  };
}

const won = (n: number | undefined | null) => `₩${(n ?? 0).toLocaleString()}`;
const num = (n: number | undefined | null) => (n ?? 0).toLocaleString();

export function ShoppingPage() {
  const { siteId } = useSite();
  const { isFree, isLoading: planLoading } = usePlan();
  const [groups, setGroups] = useState<ShoppingGroup[]>([]);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [stats, setStats] = useState<ShoppingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterDevice, setFilterDevice] = useState<'all' | 'PC' | 'M'>('all');
  const [searchText, setSearchText] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  const loadAll = async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const [groupsR, itemsR, statsR] = await Promise.allSettled([
        workerFetch<any>(`/naver/shopping-groups?site_id=${siteId}`),
        workerFetch<any>(`/naver/shopping-items?site_id=${siteId}`),
        workerFetch<any>(`/naver/shopping-stats?site_id=${siteId}`),
      ]);

      if (groupsR.status === 'fulfilled') {
        const v = groupsR.value;
        const list = Array.isArray(v) ? v : v?.data ?? v?.groups ?? [];
        setGroups(list);
      } else {
        setGroups([]);
      }

      if (itemsR.status === 'fulfilled') {
        const v = itemsR.value;
        const list = Array.isArray(v) ? v : v?.data ?? v?.items ?? [];
        setItems(list);
      } else {
        setItems([]);
      }

      if (statsR.status === 'fulfilled') {
        setStats(statsR.value);
      } else {
        setStats(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (filterGroup !== 'all' && it.group_id !== filterGroup) return false;
      if (filterDevice === 'PC' && it.rank_pc == null && it.rank_mobile != null) return false;
      if (filterDevice === 'M' && it.rank_mobile == null && it.rank_pc != null) return false;
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        if (!it.product_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filterGroup, filterDevice, searchText]);

  const runOptimizer = async () => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    if (!siteId) return;
    setRunning(true);
    try {
      await workerFetch('/naver/run-optimizer', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          type: 'shopping',
          strategy: 'target_rank',
          settings: { targetRank: 3, maxBid: 3000 },
        }),
      });
      showToast('쇼핑 입찰 최적화 완료');
      loadAll();
    } catch (e: any) {
      showToast(`실패: ${e?.message ?? ''}`);
    } finally {
      setRunning(false);
    }
  };

  const toggleActive = async (it: ShoppingItem) => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    if (!it.bid_setting_id) return;
    const next = it.is_active ? 0 : 1;
    setItems((prev) =>
      prev.map((k) => (k.bid_setting_id === it.bid_setting_id ? { ...k, is_active: next } : k)),
    );
    try {
      await workerFetch(`/naver/bid-settings/${it.bid_setting_id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: next }),
      });
    } catch {
      setItems((prev) =>
        prev.map((k) => (k.bid_setting_id === it.bid_setting_id ? { ...k, is_active: it.is_active } : k)),
      );
      showToast('변경 실패');
    }
  };

  if (planLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
        플랜 정보 확인 중...
      </div>
    );
  }

  const totals = stats?.totals ?? {};
  const kpis = [
    { label: '오늘 광고비', icon: CircleDollarSign, color: 'text-blue-600', bg: 'bg-blue-50', value: won(totals.cost) },
    { label: '클릭', icon: MousePointerClick, color: 'text-emerald-600', bg: 'bg-emerald-50', value: num(totals.clicks) },
    { label: '전환', icon: Target, color: 'text-violet-600', bg: 'bg-violet-50', value: num(totals.conversions) },
    { label: 'ROAS', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', value: totals.roas != null ? `${totals.roas.toFixed(0)}%` : '-' },
  ];

  return (
    <div className="space-y-6">
      {/* Header KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, icon: Icon, color, bg, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-300" /> : value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-2 flex-wrap">
        <ShoppingBag className="w-4 h-4 text-blue-600" />
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
        >
          <option value="all">상품그룹: 전체</option>
          {groups.map((g) => (
            <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
          ))}
        </select>
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5">
          {(['all', 'PC', 'M'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setFilterDevice(d)}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${
                filterDevice === d ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500'
              }`}
            >
              {d === 'all' ? '전체' : d === 'PC' ? 'PC' : '모바일'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="상품명 검색..."
            className="w-full text-xs border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={loadAll}
          className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          새로고침
        </button>
        <button
          onClick={runOptimizer}
          disabled={running || isFree}
          className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50 ${
            isFree ? 'bg-gray-200 text-gray-500' : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : isFree ? <Lock className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
          지금 실행
        </button>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">쇼핑 상품그룹 ({filteredItems.length}개)</h3>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            불러오는 중...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            등록된 쇼핑 상품이 없습니다. 네이버 쇼핑검색광고 계정을 연결하세요.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 font-medium">상품그룹명</th>
                  <th className="px-3 py-3 font-medium text-center">PC순위</th>
                  <th className="px-3 py-3 font-medium text-center">MO순위</th>
                  <th className="px-3 py-3 font-medium text-right">현재입찰가</th>
                  <th className="px-3 py-3 font-medium text-right">1위 견적</th>
                  <th className="px-3 py-3 font-medium text-right">3위 견적</th>
                  <th className="px-3 py-3 font-medium text-right">ROAS</th>
                  <th className="px-3 py-3 font-medium text-center">ON/OFF</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it, i) => (
                  <tr key={it.product_id ?? `${it.product_name}-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-3.5 h-3.5 text-gray-400" />
                        <span className="truncate max-w-[280px]">{it.product_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-700">
                      {it.rank_pc != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Monitor className="w-3 h-3 text-blue-500" />
                          {it.rank_pc}위
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-700">
                      {it.rank_mobile != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Smartphone className="w-3 h-3 text-violet-500" />
                          {it.rank_mobile}위
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{won(it.current_bid)}</td>
                    <td className="px-3 py-3 text-right text-xs text-gray-700">
                      {it.bid_rank1 != null ? won(it.bid_rank1) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-gray-700">
                      {it.bid_rank3 != null ? won(it.bid_rank3) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {it.roas != null ? (
                        <span className={`font-semibold ${it.roas >= 200 ? 'text-green-600' : it.roas >= 100 ? 'text-gray-700' : 'text-red-600'}`}>
                          {it.roas.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {it.bid_setting_id ? (
                        <button
                          onClick={() => toggleActive(it)}
                          disabled={isFree}
                          className={`relative inline-flex items-center w-9 h-5 rounded-full transition-colors ${
                            isFree
                              ? 'bg-gray-300 cursor-not-allowed'
                              : it.is_active
                              ? 'bg-blue-600'
                              : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block w-3.5 h-3.5 bg-white rounded-full shadow transform transition-transform ${
                              !isFree && it.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'
                            }`}
                          />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUpgrade && (
        <UpgradePrompt
          feature="쇼핑 자동입찰"
          description="쇼핑 자동입찰은 Starter 플랜부터 사용할 수 있습니다."
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
