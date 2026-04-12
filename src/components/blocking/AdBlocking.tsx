import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { registerIpExclusion, removeIpExclusion, fetchIpExclusions, fetchIpExclusionsCached, invalidateIpListCache } from '@/lib/naverApi';
import { Shield, Plus, Trash2, Search, Loader2, AlertTriangle, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { AdIpBlacklistRow } from '@/lib/types';
import { useAdStore } from '@/hooks/useAdStore';
import HelpTooltip from '@/components/common/HelpTooltip';

const SUPABASE_URL = 'https://srlkttykxpbmrusbavzi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNybGt0dHlreHBibXJ1c2JhdnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTg0NzUsImV4cCI6MjA4ODc5NDQ3NX0.9NhCaHGGltXURdgNqnZqZk4LvzS8w8EMsYLbBYvY1KM';
const NAVER_PROXY_URL = `${SUPABASE_URL}/functions/v1/naver-proxy`;

// IP 로딩 캐시
const CACHE_KEY = 'blocking_ip_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분
const PAGE_SIZE = 20;
const INITIAL_LIMIT = 200;

// 광고 유입 판정 (네이버 유료광고만)
const isNaverAdSource = (sources: string[] | undefined): boolean => {
  if (!sources || sources.length === 0) return false;
  return sources.some(s => /네이버 광고|n_media|naver_ad/i.test(s));
};

interface CachedPayload {
  detected: unknown[];
  naver: unknown[];
  fetchedAt: number;
}

interface ClickTrackerIp {
  ip: string;
  clicks: number;
  firstSeen: string;
  lastSeen: string;
  avgDwell: number;
  isVpn: boolean;
  riskScore: number;
  keywords: string[];
  sources: string[];
  naver_registered: boolean;
  hitad_blocked?: boolean;
  block_type?: string;
}

interface IpDetailData {
  ip: string;
  count: number;
  visits: number;
  totalDuration: number;
  avgDuration: number;
  scrollDepth: number;
  device: string | null;
  keywords: string[];
  events: { event: string; time: string; text?: string; element?: string; duration?: number; scrollDepth?: number }[];
  riskScore: number;
  firstSeen: string;
  lastSeen: string;
  naver_registered: boolean;
}

interface NaverBlockedIp {
  filterIp: string;
  ipFilterId: string;
  memo?: string;
  regTm?: string;
}

interface RefundRequestRow {
  id: string;
  ad_account_id: string;
  ip: string;
  click_count: number;
  keyword: string | null;
  first_seen: string | null;
  last_seen: string | null;
  estimated_amount: number;
  reason: string | null;
  status: string;
  submitted_at: string | null;
  created_at: string;
}

interface AdBlockingProps {
  adAccountId: string | undefined;
}

function RiskBadge({ score }: { score: number }) {
  const s = Math.round(score);
  if (s >= 81) return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">🔴 매우위험</span>;
  if (s >= 61) return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">🟠 위험</span>;
  if (s >= 31) return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700">🟡 주의</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">🟢 정상</span>;
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 flex-1 min-w-[140px]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdBlocking({ adAccountId }: AdBlockingProps) {
  const [blacklist, setBlacklist] = useState<AdIpBlacklistRow[]>([]);
  const [whitelist, setWhitelist] = useState<{ id: string; ip: string; description: string | null }[]>([]);
  const [naverIps, setNaverIps] = useState<NaverBlockedIp[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const { ipTab, setIpTab } = useAdStore();
  const [activeTab, setActiveTabLocal] = useState<'detected' | 'naver' | 'whitelist' | 'refund'>((ipTab as 'detected' | 'naver' | 'whitelist' | 'refund') || 'detected');
  const setActiveTab = (v: 'detected' | 'naver' | 'whitelist' | 'refund') => { setActiveTabLocal(v); setIpTab(v); };
  const [searchQuery, setSearchQuery] = useState('');
  const [registeringIds, setRegisteringIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [detailIp, setDetailIp] = useState<IpDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 정렬/필터/체크
  const [sortKey, setSortKey] = useState<'ip' | 'clicks' | 'riskScore' | 'firstSeen' | 'lastSeen' | 'status' | null>('lastSeen');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState<'all' | 'high' | 'clicks3' | 'unhandled'>('all');
  const [checkedIps, setCheckedIps] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Click Tracker 데이터
  const [detectedIps, setDetectedIps] = useState<ClickTrackerIp[]>([]);
  const [detectLoading, setDetectLoading] = useState(false);

  // IPv6 자동 환급 신청
  const [refundRequests, setRefundRequests] = useState<RefundRequestRow[]>([]);
  const ESTIMATED_CPC_REFUND = 1500;

  // 캐시 상태 & 페이지네이션
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // IP 상세 조회
  const fetchIpDetail = async (ip: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(NAVER_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ method: 'GET', path: `/click-tracker/stats/${encodeURIComponent(ip)}` }),
      });
      if (res.ok) {
        const json = await res.json();
        setDetailIp(json.data || null);
      }
    } catch { setDetailIp(null); }
    finally { setDetailLoading(false); }
  };

  // Supabase 데이터 조회
  const fetchData = useCallback(async () => {
    if (!adAccountId) return;
    setLoading(true);
    try {
      const [{ data: bl }, { data: wl }] = await Promise.all([
        supabase.from('ad_ip_blacklist').select('*').eq('ad_account_id', adAccountId).order('created_at', { ascending: false }),
        supabase.from('ad_whitelist').select('*').eq('ad_account_id', adAccountId).order('created_at', { ascending: false }),
      ]);
      setBlacklist((bl || []) as AdIpBlacklistRow[]);
      setWhitelist(wl || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [adAccountId]);

  // Click Tracker 감지 IP 조회
  const fetchDetected = useCallback(async () => {
    setDetectLoading(true);
    try {
      const res = await fetch(NAVER_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ method: 'GET', path: '/click-tracker/stats' }),
      });
      if (res.ok) {
        const json = await res.json();
        const ctData = json.data || {};
        const rawIps = ctData.ips || [];
        const threshold = ctData.threshold || 3;
        const mapped: ClickTrackerIp[] = rawIps.map((ip: Record<string, unknown>) => ({
          ip: ip.ip as string,
          clicks: (ip.count as number) || 0,
          firstSeen: (ip.firstSeen as string) || '',
          lastSeen: (ip.lastSeen as string) || '',
          avgDwell: 0,
          isVpn: false,
          riskScore: Math.min(100, ((ip.count as number) || 0) * (100 / (threshold * 3))),
          keywords: (ip.keywords as string[]) || [],
          sources: (ip.sources as string[]) || [],
          naver_registered: !!(ip.naver_registered),
        }));
        setDetectedIps(mapped);
      }
    } catch {
      setDetectedIps([]);
    } finally {
      setDetectLoading(false);
    }
  }, []);

  // 네이버 차단 IP 목록 조회 (캐시 사용)
  const fetchNaverIps = useCallback(async () => {
    if (!adAccountId) return;
    try {
      const ips = await fetchIpExclusionsCached(adAccountId, (fresh) => setNaverIps(fresh as NaverBlockedIp[]));
      setNaverIps(ips as NaverBlockedIp[]);
    } catch {
      setNaverIps([]);
    }
  }, [adAccountId]);

  // 강제 새로고침 (캐시 무효화 후 재조회)
  const refreshNaverIps = useCallback(async () => {
    if (!adAccountId) return;
    await invalidateIpListCache(adAccountId);
    return fetchNaverIps();
  }, [adAccountId, fetchNaverIps]);

  // ★ 통합 로더 — click-tracker + 네이버 IP 병렬 + localStorage 캐시
  const loadIPs = useCallback(async (forceRefresh = false) => {
    // 1. 캐시 확인
    if (!forceRefresh) {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as CachedPayload;
          if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
            setDetectedIps(cached.detected as ClickTrackerIp[]);
            setNaverIps(cached.naver as NaverBlockedIp[]);
            setLastUpdated(new Date(cached.fetchedAt));
            return;
          }
        }
      } catch { /* ignore cache errors */ }
    }

    setDetectLoading(true);
    // 2. 병렬 fetch
    const [trackerRes, naverRes] = await Promise.allSettled([
      fetch(NAVER_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ method: 'GET', path: '/click-tracker/stats' }),
      }).then(r => r.ok ? r.json() : null),
      adAccountId
        ? (forceRefresh ? invalidateIpListCache(adAccountId).then(() => fetchIpExclusions(adAccountId)) : fetchIpExclusionsCached(adAccountId))
        : Promise.resolve([]),
    ]);

    // 3. tracker 응답 매핑
    let mappedDetected: ClickTrackerIp[] = [];
    if (trackerRes.status === 'fulfilled' && trackerRes.value) {
      const ctData = trackerRes.value.data || {};
      const rawIps = ctData.ips || [];
      const threshold = ctData.threshold || 3;
      mappedDetected = rawIps.map((ip: Record<string, unknown>) => ({
        ip: ip.ip as string,
        clicks: (ip.count as number) || 0,
        firstSeen: (ip.firstSeen as string) || '',
        lastSeen: (ip.lastSeen as string) || '',
        avgDwell: (ip.avgDuration as number) || 0,
        isVpn: false,
        riskScore: Math.min(100, ((ip.count as number) || 0) * (100 / (threshold * 3))),
        keywords: (ip.keywords as string[]) || [],
        sources: (ip.sources as string[]) || [],
        naver_registered: !!(ip.naver_registered),
        hitad_blocked: !!(ip.hitad_blocked),
        block_type: (ip.block_type as string) || undefined,
      }));
      // 최신순(lastSeen 내림차순) 정렬 후 상위 INITIAL_LIMIT 만 유지
      mappedDetected.sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
      mappedDetected = mappedDetected.slice(0, INITIAL_LIMIT);
    }
    setDetectedIps(mappedDetected);

    // 4. 네이버 응답 매핑
    const naverData = (naverRes.status === 'fulfilled' ? naverRes.value : []) as NaverBlockedIp[];
    setNaverIps(naverData);

    // 5. 캐시 저장
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        detected: mappedDetected,
        naver: naverData,
        fetchedAt: Date.now(),
      } as CachedPayload));
    } catch { /* quota exceeded 등 무시 */ }

    setLastUpdated(new Date());
    setDetectLoading(false);

    // IPv6 + 네이버 광고 유입 + 3회 이상 자동 환급 대상 upsert
    // ★ 네이버 광고 유입만, 구글/자연검색/직접 유입은 제외
    if (adAccountId) {
      try {
        const ipv6Targets = mappedDetected.filter(ip => {
          if (!ip.ip || !ip.ip.includes(':')) return false;
          if (ip.clicks < 3) return false;
          const sources = ip.sources || [];
          const hasNaverAd = sources.some(s => /네이버 광고|n_media|naver_ad/i.test(s));
          if (!hasNaverAd) return false;
          // 구글 유입이 섞여있으면 제외
          const hasGoogle = sources.some(s => /google|구글/i.test(s));
          if (hasGoogle) return false;
          return true;
        });
        if (ipv6Targets.length > 0) {
          const rows = ipv6Targets.map(ip => ({
            ad_account_id: adAccountId,
            ip: ip.ip,
            click_count: ip.clicks,
            keyword: ip.keywords?.[0] || null,
            first_seen: ip.firstSeen || null,
            last_seen: ip.lastSeen || null,
            estimated_amount: ip.clicks * ESTIMATED_CPC_REFUND,
            reason: 'IPv6_auto_detected',
            status: 'pending',
          }));
          await supabase.from('refund_requests').upsert(rows, { onConflict: 'ad_account_id,ip' });
        }
        const { data: reqs } = await supabase
          .from('refund_requests')
          .select('*')
          .eq('ad_account_id', adAccountId)
          .order('created_at', { ascending: false });
        setRefundRequests((reqs || []) as RefundRequestRow[]);
      } catch (e) {
        console.error('refund auto-add failed:', e);
      }
    }
  }, [adAccountId]);

  useEffect(() => {
    fetchData();
    loadIPs();
    // 5분마다 자동 갱신
    const interval = setInterval(() => loadIPs(false), CACHE_TTL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
        loadIPs(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchData, loadIPs]);

  const refreshAll = () => { fetchData(); loadIPs(true); };

  // IP 추가 (화이트리스트)
  const addWhitelistIp = async () => {
    if (!adAccountId || !newIp.trim()) return;
    await supabase.from('ad_whitelist').insert({
      ad_account_id: adAccountId,
      ip: newIp.trim(),
      description: newDesc.trim() || null,
      type: 'whitelist',
    });
    setNewIp(''); setNewDesc('');
    toast.success('화이트리스트 추가됨');
    fetchData();
  };

  // IP 수동 차단 (Supabase + 네이버 동시 등록)
  const addBlockIp = async () => {
    if (!adAccountId || !newIp.trim()) return;
    const ip = newIp.trim();
    try {
      // 1. Supabase 차단 목록 upsert (select-then-insert/update, unique 제약 없어서 upsert onConflict 사용 불가)
      const { data: existing, error: selErr } = await supabase
        .from('ad_ip_blacklist')
        .select('id')
        .eq('ad_account_id', adAccountId)
        .eq('ip', ip)
        .maybeSingle();
      if (selErr) {
        console.error('[addBlockIp] select error:', selErr);
        toast.error(`DB 조회 실패: ${selErr.message}`);
        return;
      }
      if (!existing) {
        const { error: insErr } = await supabase.from('ad_ip_blacklist').insert({
          ad_account_id: adAccountId,
          ip,
          description: newDesc.trim() || '수동 추가',
          type: 'blacklist',
          click_count: 0,
        });
        if (insErr) {
          console.error('[addBlockIp] insert error:', insErr);
          toast.error(`DB 저장 실패: ${insErr.message}`);
          return;
        }
      }
      // 2. 네이버 등록
      try {
        const result = await registerIpExclusion(adAccountId, ip);
        if (!result.error) {
          const { error: updErr } = await supabase.from('ad_ip_blacklist').update({
            naver_registered: true,
            registered_at: new Date().toISOString(),
          }).eq('ad_account_id', adAccountId).eq('ip', ip);
          if (updErr) console.error('[addBlockIp] update error:', updErr);
          toast.success(`${ip} 차단 + 네이버 등록 완료`);
        } else {
          toast.error(`네이버 등록 실패: ${result.error}`);
        }
      } catch (naverErr) {
        toast.error(`네이버 등록 중 오류: ${(naverErr as Error).message}`);
      }
      setNewIp(''); setNewDesc('');
      fetchData(); fetchNaverIps();
    } catch (err) {
      toast.error(`IP 차단 실패: ${(err as Error).message}`);
    }
  };

  const removeIp = async (id: string, table: string) => {
    await supabase.from(table).delete().eq('id', id);
    toast.success('삭제됨');
    fetchData();
  };

  // 네이버에 IP 차단 등록 (감지 IP → 네이버 등록)
  const handleRegisterNaver = async (ip: string) => {
    if (!adAccountId) return;
    setRegisteringIds(prev => new Set(prev).add(ip));
    try {
      const result = await registerIpExclusion(adAccountId, ip);
      if (result.error) {
        toast.error(`네이버 등록 실패: ${result.error}`);
      } else {
        // 검증: 재조회하여 실제 등록 확인
        const ips = await fetchIpExclusions(adAccountId);
        const found = ips.find(i => i.filterIp === ip);
        if (found) toast.success(`✅ ${ip} 차단 등록 확인됨`);
        else toast.error(`⚠️ ${ip} 등록 확인 실패`);
        // Supabase에도 기록 (unique 제약 없음 → select-then-insert/update)
        const { data: existing, error: selErr } = await supabase
          .from('ad_ip_blacklist')
          .select('id')
          .eq('ad_account_id', adAccountId)
          .eq('ip', ip)
          .maybeSingle();
        if (selErr) {
          console.error('[handleRegisterNaver] select error:', selErr);
        } else if (existing) {
          const { error: updErr } = await supabase.from('ad_ip_blacklist').update({
            naver_registered: true,
            registered_at: new Date().toISOString(),
          }).eq('id', existing.id);
          if (updErr) console.error('[handleRegisterNaver] update error:', updErr);
        } else {
          const { error: insErr } = await supabase.from('ad_ip_blacklist').insert({
            ad_account_id: adAccountId,
            ip,
            description: '자동 감지 → 네이버 등록',
            type: 'blacklist',
            click_count: 0,
            naver_registered: true,
            registered_at: new Date().toISOString(),
          });
          if (insErr) console.error('[handleRegisterNaver] insert error:', insErr);
        }
        fetchData(); fetchNaverIps();
      }
    } catch {
      toast.error('네이버 등록 실패');
    } finally {
      setRegisteringIds(prev => { const s = new Set(prev); s.delete(ip); return s; });
    }
  };

  // 네이버 차단 삭제
  const handleDeleteNaverIp = async (ipFilterId: string, ip: string) => {
    if (!adAccountId) return;
    if (!confirm(`${ip}를 네이버 차단 목록에서 삭제하시겠습니까?`)) return;
    setDeletingIds(prev => new Set(prev).add(ipFilterId));
    try {
      const result = await removeIpExclusion(adAccountId, ipFilterId);
      if (result.error) {
        toast.error(`삭제 실패: ${result.error}`);
      } else {
        // Supabase ad_ip_blacklist 에서도 제거 (네이버 ↔ DB 일관성)
        const { error: delErr } = await supabase
          .from('ad_ip_blacklist')
          .delete()
          .eq('ad_account_id', adAccountId)
          .eq('ip', ip);
        if (delErr) console.error('[handleDeleteNaverIp] delete error:', delErr);
        toast.success(`네이버 차단 삭제: ${ip}`);
        fetchNaverIps();
        fetchData();
      }
    } catch {
      toast.error('삭제 실패');
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(ipFilterId); return s; });
    }
  };

  // 차단 해제 (click-tracker /unblock + Supabase 정리)
  const handleUnblockIp = async (ip: string, type: 'naver' | 'hitad' | 'all') => {
    if (!confirm(`${ip} 차단을 해제하시겠습니까?`)) return;
    try {
      const res = await fetch('https://click-tracker.viphome.kr/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, type }),
      });
      const data = await res.json().catch(() => ({} as any));

      if (res.ok && (data?.success ?? true)) {
        if (adAccountId) {
          await supabase
            .from('ad_ip_blacklist')
            .delete()
            .eq('ad_account_id', adAccountId)
            .eq('ip', ip);
        }

        // 네이버 등록 IP라면 네이버 API 호출도 시도 (best-effort)
        if (type !== 'hitad' && adAccountId) {
          const target = naverIps.find(n => n.filterIp === ip && !String(n.ipFilterId).startsWith('hitad-'));
          if (target) {
            try { await removeIpExclusion(adAccountId, target.ipFilterId); } catch {}
          }
        }

        toast.success(`✅ ${ip} 차단 해제 완료`);
        fetchData();
        fetchNaverIps();
      } else {
        toast.error(`❌ 해제 실패: ${data?.message || JSON.stringify(data?.results || data)}`);
      }
    } catch (e) {
      toast.error(`❌ 해제 오류: ${(e as Error).message}`);
    }
  };

  // 네이버 등록된 IP Set (감지 탭에서 상태 표시용)
  const naverRegisteredSet = new Set(naverIps.map(n => n.filterIp));
  const blacklistedSet = new Set(blacklist.map(b => b.ip));

  // 부정클릭 환불
  // 고위험 IP: 위험도 80점 이상 + 네이버 광고 유입 + 구글 제외
  // (자연검색/직접/구글 유입은 광고비 환불 대상 아님)
  const highRiskIps = detectedIps.filter(ip => {
    if (ip.riskScore < 80) return false;
    const sources = ip.sources || [];
    const isNaverAd = sources.some(s => /네이버 광고|n_media|naver_ad/i.test(s));
    if (!isNaverAd) return false;
    const hasGoogle = sources.some(s => /google|구글/i.test(s));
    if (hasGoogle) return false;
    return true;
  });
  const estimatedCpc = 500; // 평균 CPC 추정

  const generateRefundReport = () => {
    if (highRiskIps.length === 0) { toast.error('위험도 80점 이상 IP가 없습니다'); return ''; }
    const totalClicks = highRiskIps.reduce((s, ip) => s + ip.clicks, 0);
    const estimatedRefund = totalClicks * estimatedCpc;
    const lines = [
      '[무효클릭 조사 요청]',
      '',
      `광고 계정 ID: ${adAccountId}`,
      '광고유형: 사이트검색광고',
      `작성일: ${new Date().toLocaleDateString('ko-KR')}`,
      '',
      '[의심 IP 목록]',
      '',
    ];
    for (const ip of highRiskIps) {
      const kws = ip.keywords.length > 0 ? ip.keywords.slice(0, 3).join(', ') : '없음';
      const dur = ip.avgDwell > 0 ? `${ip.avgDwell}초` : '1초 미만';
      lines.push(
        `IP: ${ip.ip}`,
        `클릭 횟수: ${ip.clicks}회`,
        `평균 체류시간: ${dur}`,
        `최초 감지: ${ip.firstSeen ? new Date(ip.firstSeen).toLocaleString('ko-KR') : '-'}`,
        `최근 클릭: ${ip.lastSeen ? new Date(ip.lastSeen).toLocaleString('ko-KR') : '-'}`,
        `유입 키워드: ${kws}`,
        '---',
      );
    }
    lines.push('');
    lines.push(`총 부정클릭 의심 IP: ${highRiskIps.length}개`);
    lines.push(`총 부정 클릭수: ${totalClicks}회`);
    lines.push(`예상 환불액: ${estimatedRefund.toLocaleString()}원 (평균 CPC ${estimatedCpc}원 기준)`);
    lines.push('');
    lines.push('위 IP들에서 반복적인 광고 클릭이 감지되었습니다.');
    lines.push('특히 평균 체류시간이 매우 짧아 구매 의도 없는');
    lines.push('부정클릭으로 의심됩니다. 무효클릭 조사를 요청드립니다.');
    return lines.join('\n');
  };

  const handleCopyRefund = () => {
    const report = generateRefundReport();
    if (!report) return;
    navigator.clipboard.writeText(report);
    toast.success('신청서가 복사됐어요! 네이버 페이지에 붙여넣기 하세요.');
    setTimeout(() => {
      window.open('https://ads.naver.com/help/invalid', '_blank');
    }, 500);
  };

  // 필터링 + 정렬 — 네이버 유료광고 유입만 표시 (자연검색/구글/직접 제외)
  const filteredDetected = detectedIps
    .filter(item => isNaverAdSource(item.sources))
    .filter(item => item.ip.includes(searchQuery))
    .filter(item => {
      if (filter === 'high') return item.riskScore >= 61;
      if (filter === 'clicks3') return item.clicks >= 3;
      if (filter === 'unhandled') return !naverRegisteredSet.has(item.ip) && !blacklistedSet.has(item.ip);
      return true;
    })
    .sort((a, b) => {
      if (sortKey === null) return 0;
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'ip') return a.ip.localeCompare(b.ip) * dir;
      if (sortKey === 'clicks') return (a.clicks - b.clicks) * dir;
      if (sortKey === 'riskScore') return (a.riskScore - b.riskScore) * dir;
      if (sortKey === 'firstSeen') return ((a.firstSeen || '') < (b.firstSeen || '') ? -1 : 1) * dir;
      if (sortKey === 'lastSeen') return ((a.lastSeen || '') < (b.lastSeen || '') ? -1 : 1) * dir;
      if (sortKey === 'status') {
        const rank = (ip: string) => naverRegisteredSet.has(ip) ? 2 : blacklistedSet.has(ip) ? 1 : 0;
        return (rank(a.ip) - rank(b.ip)) * dir;
      }
      return 0;
    });

  // 페이지네이션 — 20개씩
  const totalPages = Math.max(1, Math.ceil(filteredDetected.length / PAGE_SIZE));
  const pagedDetected = filteredDetected.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  // 필터/검색 변경 시 1페이지로 리셋
  useEffect(() => { setCurrentPage(1); }, [filter, searchQuery, detectedIps.length]);

  const handleSort = (key: NonNullable<typeof sortKey>) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    setSortKey(null); // 세번째 클릭: 기본순(정렬 해제)
  };
  const toggleCheck = (ip: string) => setCheckedIps(prev => { const s = new Set(prev); if (s.has(ip)) s.delete(ip); else s.add(ip); return s; });
  const toggleAll = () => {
    const actionable = filteredDetected.filter(ip => !naverRegisteredSet.has(ip.ip));
    if (checkedIps.size >= actionable.length) setCheckedIps(new Set());
    else setCheckedIps(new Set(actionable.map(ip => ip.ip)));
  };
  const handleBulkRegister = async () => {
    if (checkedIps.size === 0 || !adAccountId) return;
    setBulkLoading(true);
    let ok = 0;
    for (const ip of checkedIps) {
      try {
        const result = await registerIpExclusion(adAccountId, ip);
        if (!result.error) ok++;
      } catch { /* skip */ }
    }
    toast.success(`${ok}개 IP 네이버 등록 완료`);
    setCheckedIps(new Set());
    setBulkLoading(false);
    refreshAll();
  };

  // IPv6 판정 (콜론 2개 이상)
  const isIpv6 = (ip: string) => typeof ip === 'string' && ip.includes(':') && ip.split(':').length >= 3;

  // 히트AD 자체 차단 (네이버가 IPv6 미지원이므로 Supabase + click-tracker KV에 기록)
  const handleHitadBlock = async (ip: string) => {
    if (!adAccountId) return;
    setRegisteringIds(prev => new Set(prev).add(ip));
    try {
      await supabase.from('ad_ip_blacklist').upsert({
        ad_account_id: adAccountId,
        ip,
        description: 'IPv6 — 히트AD 자체 차단 (네이버 미지원)',
        type: 'blacklist',
        click_count: detectedIps.find(d => d.ip === ip)?.clicks || 0,
        naver_registered: false,
      }, { onConflict: 'ad_account_id,ip' });
      // 화이트리스트에 있으면 제거
      await supabase.from('ad_whitelist').delete().eq('ad_account_id', adAccountId).eq('ip', ip);

      // click-tracker /block 엔드포인트 호출 시도 — 없으면 404 무시 (Supabase 저장만으로도 차단 유효)
      try {
        await fetch('https://click-tracker.viphome.kr/block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip }),
        });
      } catch { /* Worker 미구현 시 무시 */ }

      toast.success('✅ 히트AD 자체차단 완료\n해당 IP 방문 시 법적 경고페이지가 표시됩니다');
      await fetchData();
    } catch (e) {
      toast.error(`차단 실패: ${(e as Error).message}`);
    } finally {
      setRegisteringIds(prev => { const n = new Set(prev); n.delete(ip); return n; });
    }
  };

  // 환불신청 → refund 탭으로 이동
  const handleRefundRequest = (ip: ClickTrackerIp) => {
    setActiveTab('refund');
    setSearchQuery(ip.ip);
  };

  // 환급 신청서 텍스트 생성 (IPv6 자동감지 행 단위)
  const generateRefundTextRow = (req: RefundRequestRow): string => {
    const firstSeen = req.first_seen ? new Date(req.first_seen).toLocaleString('ko-KR') : '-';
    const lastSeen = req.last_seen ? new Date(req.last_seen).toLocaleString('ko-KR') : '-';
    return [
      '부정클릭 환급 신청',
      '',
      `IP: ${req.ip}`,
      `클릭수: ${req.click_count}회`,
      `유입키워드: ${req.keyword || '-'}`,
      `클릭기간: ${firstSeen} ~ ${lastSeen}`,
      `예상피해금액: ${(req.estimated_amount || 0).toLocaleString()}원`,
      `사유: IPv6 주소로 네이버 IP차단 불가`,
      '',
      '위 부정클릭에 대한 환급을 신청합니다.',
    ].join('\n');
  };

  const handleCopyRefundRow = (req: RefundRequestRow) => {
    navigator.clipboard.writeText(generateRefundTextRow(req));
    toast.success('환급 신청서가 클립보드에 복사되었습니다');
  };

  const handleMarkRefundSubmitted = async (req: RefundRequestRow) => {
    if (!adAccountId) return;
    try {
      await supabase.from('refund_requests')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', req.id);
      setRefundRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'submitted', submitted_at: new Date().toISOString() } : r));
      toast.success('신청완료 처리됨');
    } catch (e) {
      toast.error(`상태 변경 실패: ${(e as Error).message}`);
    }
  };

  // 미처리 전체 일괄 등록
  const handleRegisterAllUnhandled = async () => {
    if (!adAccountId) return;
    const unhandled = detectedIps.filter(ip => !naverRegisteredSet.has(ip.ip) && !blacklistedSet.has(ip.ip));
    if (unhandled.length === 0) {
      toast.info('미처리 IP가 없습니다');
      return;
    }
    if (!confirm(`미처리 ${unhandled.length}개 IP를 모두 네이버에 등록하시겠습니까?`)) return;
    setBulkLoading(true);
    let ok = 0;
    for (const ip of unhandled) {
      try {
        const result = await registerIpExclusion(adAccountId, ip.ip);
        if (!result.error) ok++;
      } catch { /* skip */ }
    }
    toast.success(`${ok}/${unhandled.length}개 IP 네이버 등록 완료`);
    setBulkLoading(false);
    refreshAll();
  };
  // 네이버 등록 IP + 히트AD 자체차단된 IPv6 통합 표시
  const ipv6HitadBlocked: NaverBlockedIp[] = blacklist
    .filter(b => isIpv6(b.ip) && !naverIps.some(n => n.filterIp === b.ip))
    .map(b => ({
      filterIp: b.ip,
      ipFilterId: `hitad-${b.id}`,
      memo: b.description || '히트AD 자체차단 (네이버 미지원)',
      regTm: b.created_at,
    }));
  const mergedNaver = [...naverIps, ...ipv6HitadBlocked];
  const filteredNaver = mergedNaver.filter(item =>
    item.filterIp.includes(searchQuery) || (item.memo || '').includes(searchQuery)
  );
  const filteredWhitelist = whitelist.filter(item =>
    item.ip.includes(searchQuery) || (item.description || '').includes(searchQuery)
  );

  // 절감 광고비 추정
  const blockedClicks = detectedIps.filter(ip => naverRegisteredSet.has(ip.ip) || blacklistedSet.has(ip.ip)).reduce((s, ip) => s + ip.clicks, 0);
  const savedCost = blockedClicks * estimatedCpc;

  if (!adAccountId) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5" />IP 차단 관리
        </h2>
        <div className="bg-white rounded-xl border shadow-sm p-10 text-center text-muted-foreground">
          광고 계정을 먼저 설정해주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5" />IP 차단 관리
          <HelpTooltip
            title="IP 차단 관리"
            auto="방문자 IP 자동 수집. 네이버 유료광고 유입 3회 이상 클릭 시 자동 차단 등록. IPv6는 히트AD 자체차단 + 경고페이지 표시."
            manual="화이트리스트에 직원·홍보관 IP 등록 필수. IPv6 부정클릭은 환불신청 탭에서 클린센터 신청."
          />
        </h2>
        <button onClick={refreshAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3 h-3" />새로고침
        </button>
      </div>

      {/* 상단 요약 카드 */}
      <div className="flex gap-3 flex-wrap">
        <SummaryCard label="감지 IP" value={detectedIps.length} sub={`총 ${detectedIps.reduce((s, ip) => s + ip.clicks, 0)}클릭`} color="text-foreground" />
        <SummaryCard label="네이버 등록" value={naverIps.length} sub={`${naverIps.length} / 600`} color="text-blue-600" />
        <SummaryCard label="화이트리스트" value={whitelist.length} color="text-green-600" />
        <SummaryCard label="절감 광고비" value={savedCost > 0 ? `${Math.round(savedCost / 10000)}만원` : '-'} sub={savedCost > 0 ? `차단 ${blockedClicks}클릭 x CPC ${estimatedCpc}원` : ''} color="text-orange-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {([
          { key: 'detected' as const, label: '자동 감지', count: detectedIps.length },
          { key: 'naver' as const, label: '차단 목록', count: naverIps.length },
          { key: 'whitelist' as const, label: '허용 목록', count: whitelist.length },
          { key: 'refund' as const, label: '환불신청', count: highRiskIps.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === tab.key
                ? 'bg-foreground text-white'
                : 'bg-white border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {tab.label}
            {tab.count > 0 && <span className="ml-1 text-xs opacity-70">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="IP 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>

      {/* ===== 탭 1: 자동 감지 ===== */}
      {activeTab === 'detected' && (
        <>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            click-tracker가 수집한 방문자 IP 목록입니다. 3회 이상 네이버 광고 유입 IP는 자동 차단됩니다.
          </div>
          {/* 자동차단 상태 배너 */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base">🤖</span>
              <div>
                <p className="font-bold text-blue-800">자동차단 활성화 중</p>
                <p className="text-[11px] text-blue-600">3회 이상 클릭 시 즉시 네이버 등록</p>
              </div>
            </div>
            {(() => {
              const urgentCount = detectedIps.filter(ip => ip.clicks >= 3 && !naverRegisteredSet.has(ip.ip) && !blacklistedSet.has(ip.ip)).length;
              const unhandledCount = detectedIps.filter(ip => !naverRegisteredSet.has(ip.ip) && !blacklistedSet.has(ip.ip)).length;
              return (
                <div className="flex items-center gap-2">
                  {urgentCount > 0 && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold animate-pulse">
                      🚨 즉시차단 필요 {urgentCount}개
                    </span>
                  )}
                  {unhandledCount > 0 && (
                    <button onClick={handleRegisterAllUnhandled} disabled={bulkLoading}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 disabled:opacity-50 flex items-center gap-1">
                      {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      미처리 {unhandledCount}개 전체 등록
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 필터 바 */}
          <div className="flex gap-1 flex-wrap">
            {([
              { key: 'all' as const, label: '전체', count: detectedIps.length },
              { key: 'high' as const, label: '위험 IP만', count: detectedIps.filter(ip => ip.riskScore >= 61).length },
              { key: 'clicks3' as const, label: '클릭 3회+', count: detectedIps.filter(ip => ip.clicks >= 3).length },
              { key: 'unhandled' as const, label: '미처리만', count: detectedIps.filter(ip => !naverRegisteredSet.has(ip.ip) && !blacklistedSet.has(ip.ip)).length },
            ]).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${filter === f.key ? 'bg-blue-500 text-white' : 'bg-white border text-muted-foreground hover:bg-muted/50'}`}>
                {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
              </button>
            ))}
          </div>

          {/* 일괄 처리 바 */}
          {checkedIps.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <span className="font-medium text-blue-700">{checkedIps.size}개 선택됨</span>
              <button onClick={handleBulkRegister} disabled={bulkLoading}
                className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:opacity-50">
                {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                선택 항목 네이버 일괄등록
              </button>
              <button onClick={() => setCheckedIps(new Set())} className="text-xs text-muted-foreground hover:text-foreground">선택 해제</button>
            </div>
          )}

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground">부정클릭 의심 IP</h3>
                <p className="text-xs text-muted-foreground mt-0.5">click-tracker에서 자동 감지 | 3회 이상 클릭 시 자동 차단</p>
              </div>
              {/* 캐시 상태 배너 */}
              <div className="flex items-center gap-2 shrink-0">
                {lastUpdated && (
                  <span className="text-[11px] text-muted-foreground">
                    마지막 업데이트: {(() => {
                      const mins = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
                      if (mins < 1) return '방금 전';
                      if (mins < 60) return `${mins}분 전`;
                      const hrs = Math.floor(mins / 60);
                      return `${hrs}시간 전`;
                    })()}
                  </span>
                )}
                <button
                  onClick={() => loadIPs(true)}
                  disabled={detectLoading}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${detectLoading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-8 px-2 py-2 text-center">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded"
                        checked={checkedIps.size > 0 && checkedIps.size >= filteredDetected.filter(ip => !naverRegisteredSet.has(ip.ip)).length}
                        onChange={toggleAll} />
                    </th>
                    {([
                      { key: 'ip' as const, label: 'IP', align: 'text-left' },
                      { key: 'clicks' as const, label: '클릭', align: 'text-center' },
                      { key: 'riskScore' as const, label: '위험도', align: 'text-center' },
                      { key: 'firstSeen' as const, label: '최초 감지', align: 'text-left' },
                      { key: 'lastSeen' as const, label: '최근 감지', align: 'text-left' },
                      { key: 'status' as const, label: '상태', align: 'text-center' },
                    ]).map(col => (
                      <th key={col.key} className={`${col.align} px-3 py-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none`}
                        onClick={() => handleSort(col.key)}>
                        {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                      </th>
                    ))}
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">CPC</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">총 소요비용</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {detectLoading && detectedIps.length === 0 ? (
                    // 스켈레톤 5행
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`sk-${i}`} className="border-t animate-pulse">
                        <td className="px-2 py-3 text-center"><div className="w-3.5 h-3.5 bg-slate-200 rounded mx-auto" /></td>
                        <td className="px-3 py-3"><div className="h-3 bg-slate-200 rounded w-28" /><div className="h-2 bg-slate-100 rounded w-20 mt-1" /></td>
                        <td className="px-3 py-3 text-center"><div className="h-3 bg-slate-200 rounded w-6 mx-auto" /></td>
                        <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-200 rounded w-14 mx-auto" /></td>
                        <td className="px-3 py-3"><div className="h-3 bg-slate-200 rounded w-24" /></td>
                        <td className="px-3 py-3"><div className="h-3 bg-slate-200 rounded w-24" /></td>
                        <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-200 rounded w-12 mx-auto" /></td>
                        <td className="px-3 py-3 text-right"><div className="h-3 bg-slate-200 rounded w-12 ml-auto" /></td>
                        <td className="px-3 py-3 text-right"><div className="h-3 bg-slate-200 rounded w-16 ml-auto" /></td>
                        <td className="px-3 py-3 text-center"><div className="h-5 bg-slate-200 rounded w-10 mx-auto" /></td>
                      </tr>
                    ))
                  ) : filteredDetected.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      {detectedIps.length === 0 ? (
                        <div><p className="font-medium mb-1">감지된 IP가 없어요</p><p className="text-xs">click-tracker Worker가 IP를 수집하면 여기에 표시됩니다</p></div>
                      ) : '필터 조건에 맞는 IP가 없습니다.'}
                    </td></tr>
                  ) : (
                    pagedDetected.map(ip => {
                      const ipv6 = isIpv6(ip.ip);
                      const hitadBlocked = !!ip.hitad_blocked || (ipv6 && blacklistedSet.has(ip.ip));
                      const naverBlocked = !ipv6 && (naverRegisteredSet.has(ip.ip) || ip.naver_registered || blacklistedSet.has(ip.ip));
                      const isBlocked = naverBlocked || hitadBlocked;
                      const needRefund = ipv6 && ip.clicks >= 3;
                      const rowBg = ip.clicks >= 5 ? 'bg-red-50/60' : ip.clicks >= 3 ? 'bg-yellow-50/60' : '';
                      return (
                        <tr key={ip.ip} className={`border-t hover:bg-muted/30 ${rowBg}`}>
                          <td className="px-2 py-2 text-center">
                            {!isBlocked && (
                              <input type="checkbox" className="w-3.5 h-3.5 rounded"
                                checked={checkedIps.has(ip.ip)} onChange={() => toggleCheck(ip.ip)} />
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs cursor-pointer hover:bg-muted/20" onClick={() => fetchIpDetail(ip.ip)}>
                            <div className="font-mono font-medium text-blue-600 hover:underline">{ip.ip}</div>
                            {ip.keywords && ip.keywords.length > 0 && (
                              <div className="text-[10px] text-slate-600 truncate max-w-[200px]" title={ip.keywords.join(', ')}>
                                🔑 {ip.keywords.slice(0, 2).join(', ')}{ip.keywords.length > 2 && ` +${ip.keywords.length - 2}`}
                              </div>
                            )}
                            {ip.sources && ip.sources.length > 0 && (() => {
                              const src = ip.sources[0];
                              const isAd = /네이버 광고|n_media|naver_ad/i.test(src);
                              const isNaver = /네이버/i.test(src) && !isAd;
                              const isGoogle = /구글|google/i.test(src);
                              const label = isAd ? '🔵 네이버광고' : isNaver ? '🟢 네이버자연' : isGoogle ? '🔴 구글' : '⚪ 직접/기타';
                              return (
                                <div className="text-[10px] text-slate-500 truncate max-w-[200px]" title={src}>
                                  {label}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2 text-center font-bold">{ip.clicks}</td>
                          <td className="px-3 py-2 text-center"><RiskBadge score={ip.riskScore} /></td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {ip.firstSeen ? new Date(ip.firstSeen).toLocaleString('ko-KR') : '-'}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {ip.lastSeen ? new Date(ip.lastSeen).toLocaleString('ko-KR') : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {hitadBlocked ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">🟠 히트AD</span>
                            ) : naverBlocked ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">🔴 네이버</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">미처리</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                            {estimatedCpc.toLocaleString()}원
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-orange-600">
                            {(ip.clicks * estimatedCpc).toLocaleString()}원
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isBlocked ? (
                              <div className="flex flex-col items-center gap-1">
                                {hitadBlocked && ipv6 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded text-[10px] font-medium">
                                    🟠 히트AD 자체차단
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-medium">
                                    🔴 네이버 차단등록
                                  </span>
                                )}
                                {needRefund && (
                                  <button
                                    onClick={() => handleRefundRequest(ip)}
                                    className="px-2 py-1 text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100">
                                    💰 환불신청
                                  </button>
                                )}
                                <button
                                  onClick={() => handleUnblockIp(ip.ip, ipv6 ? 'hitad' : 'all')}
                                  disabled={registeringIds.has(ip.ip)}
                                  className="px-2 py-1 text-[10px] bg-gray-50 text-gray-500 border border-gray-200 rounded hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                                  {registeringIds.has(ip.ip) ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '차단 해제'}
                                </button>
                              </div>
                            ) : ipv6 ? (
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => handleHitadBlock(ip.ip)}
                                  disabled={registeringIds.has(ip.ip)}
                                  title={"IPv6는 네이버 차단 미지원\n히트AD 자체차단으로 처리됩니다.\n차단된 IP 방문 시 경고페이지가 표시됩니다."}
                                  className="px-2 py-1 text-[10px] bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50">
                                  {registeringIds.has(ip.ip) ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '히트AD 차단'}
                                </button>
                                {needRefund && (
                                  <button
                                    onClick={() => handleRefundRequest(ip)}
                                    className="px-2 py-1 text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100">
                                    💰 환불신청
                                  </button>
                                )}
                                <span className="text-[9px] text-gray-400">⚠️ 네이버 미지원</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRegisterNaver(ip.ip)}
                                disabled={registeringIds.has(ip.ip)}
                                className="px-2 py-1 text-[10px] bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50">
                                {registeringIds.has(ip.ip) ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '네이버 등록'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* 페이지네이션 */}
            {filteredDetected.length > PAGE_SIZE && (
              <div className="px-4 py-3 border-t flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredDetected.length)} / {filteredDetected.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
                  >이전</button>
                  {(() => {
                    const pages: number[] = [];
                    const start = Math.max(1, currentPage - 2);
                    const end = Math.min(totalPages, start + 4);
                    for (let i = start; i <= end; i++) pages.push(i);
                    return pages.map(p => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 py-1 rounded ${
                          p === currentPage
                            ? 'bg-[#093687] text-white'
                            : 'border border-slate-200 hover:bg-slate-50'
                        }`}
                      >{p}</button>
                    ));
                  })()}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
                  >다음</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== 탭 2: 차단 목록 (네이버 등록된 IP) ===== */}
      {activeTab === 'naver' && (
        <>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            네이버 광고시스템에 등록된 IP는 광고 클릭해도 과금되지 않습니다. 최대 600개.
          </div>
          {/* 안내 배너 */}
          <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 leading-relaxed">
            <strong>히트AD 차단 = 네이버 광고시스템에 IP 차단 등록.</strong>{' '}
            차단된 IP에서 클릭해도 광고비가 청구되지 않습니다. 네이버 정책상 최대 600개까지 등록 가능합니다.
          </div>

          {/* IP 수동 차단 */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="font-semibold text-foreground mb-2">IP 수동 차단</h3>
            <p className="text-xs text-muted-foreground mb-3">Supabase 차단 목록 + 네이버 IP 차단에 자동 등록됩니다</p>
            <div className="flex flex-wrap gap-3">
              <input type="text" placeholder="IP 주소 (예: 123.45.67.89)" value={newIp} onChange={e => setNewIp(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <input type="text" placeholder="설명 (선택)" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <button onClick={addBlockIp} disabled={!newIp.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">
                <Plus className="w-4 h-4" />차단 등록
              </button>
            </div>
          </div>

          {/* 네이버 차단 IP 테이블 */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-foreground">네이버 차단 IP 목록</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                네이버 검색광고 IP 차단 등록 현황 ({naverIps.length} / 600)
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${naverIps.length > 480 ? 'bg-red-500' : naverIps.length > 300 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min((naverIps.length / 600) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">IP</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">메모</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">등록일</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />로딩 중...
                    </td></tr>
                  ) : filteredNaver.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      등록된 IP가 없습니다
                    </td></tr>
                  ) : (
                    filteredNaver.map(ip => {
                      const isHitad = String(ip.ipFilterId).startsWith('hitad-');
                      return (
                      <tr key={ip.ipFilterId} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-mono font-semibold text-xs">
                          <div className="flex items-center gap-2">
                            <span>{ip.filterIp}</span>
                            {isHitad ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-700" title="네이버는 IPv6 차단 미지원 — 히트AD 자체차단">
                                🟠 히트AD 자체차단
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">
                                🔴 네이버 차단등록
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{ip.memo || '-'}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {ip.regTm ? new Date(typeof ip.regTm === 'string' ? ip.regTm : Number(ip.regTm)).toLocaleDateString('ko-KR') : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleUnblockIp(ip.filterIp, isHitad ? 'hitad' : 'naver')}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-red-50 hover:text-red-600 border border-gray-200"
                            >
                              차단 해제
                            </button>
                            {!isHitad && (
                              <button
                                onClick={() => handleDeleteNaverIp(ip.ipFilterId, ip.filterIp)}
                                disabled={deletingIds.has(ip.ipFilterId)}
                                className="p-1 text-red-400 hover:text-red-600 disabled:opacity-50"
                                title="네이버 직접 삭제"
                              >
                                {deletingIds.has(ip.ipFilterId) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );})
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===== 탭 3: 허용 목록 (화이트리스트) ===== */}
      {activeTab === 'whitelist' && (
        <>
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="font-semibold text-foreground mb-3">IP 허용 추가</h3>
            <div className="flex flex-wrap gap-3">
              <input type="text" placeholder="IP 주소" value={newIp} onChange={e => setNewIp(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <input type="text" placeholder="설명 (예: 사무실 IP)" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <button onClick={addWhitelistIp} disabled={!newIp.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                <Plus className="w-4 h-4" />추가
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-foreground">화이트리스트</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{filteredWhitelist.length}개 IP</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">IP</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">설명</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">로딩 중...</td></tr>
                  ) : filteredWhitelist.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">화이트리스트가 비어있습니다</td></tr>
                  ) : (
                    filteredWhitelist.map(item => (
                      <tr key={item.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-mono font-medium text-xs">{item.ip}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{item.description || '-'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => removeIp(item.id, 'ad_whitelist')}
                            className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===== 탭 4: 환불신청 ===== */}
      {activeTab === 'refund' && (
        <div className="space-y-4">
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            IPv6 주소는 네이버 차단이 불가합니다. 아래 신청서를 클린센터에 제출하면 광고비 환불됩니다.
          </div>
          {/* IPv6 자동 감지 환급 신청서 */}
          {refundRequests.length > 0 && (
            <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-orange-50">
                <h3 className="font-semibold text-orange-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />IPv6 자동 감지 환급 대상 ({refundRequests.length}건)
                </h3>
                <p className="text-xs text-orange-700 mt-1">
                  광고 유입 + 3회 이상 클릭인 IPv6 주소는 네이버 IP차단이 불가하므로 자동으로 환급 신청 대상에 추가됩니다.
                  [신청서 복사] 후 네이버 클린센터에 제출하세요.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium text-slate-700">IP</th>
                      <th className="px-3 py-2 font-medium text-slate-700 text-center">클릭</th>
                      <th className="px-3 py-2 font-medium text-slate-700">키워드</th>
                      <th className="px-3 py-2 font-medium text-slate-700">기간</th>
                      <th className="px-3 py-2 font-medium text-slate-700 text-right">예상금액</th>
                      <th className="px-3 py-2 font-medium text-slate-700 text-center">상태</th>
                      <th className="px-3 py-2 font-medium text-slate-700 text-center">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundRequests.map(req => {
                      const isSubmitted = req.status === 'submitted' || req.status === 'refunded';
                      return (
                        <tr key={req.id} className={`border-t ${isSubmitted ? 'bg-green-50/30' : 'hover:bg-slate-50'}`}>
                          <td className="px-3 py-2 font-mono text-xs break-all max-w-[220px]">{req.ip}</td>
                          <td className="px-3 py-2 text-center font-bold">{req.click_count}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 max-w-[160px] truncate" title={req.keyword || ''}>{req.keyword || '-'}</td>
                          <td className="px-3 py-2 text-[11px] text-slate-500">
                            {req.first_seen ? new Date(req.first_seen).toLocaleDateString('ko-KR') : '-'} ~
                            {req.last_seen ? new Date(req.last_seen).toLocaleDateString('ko-KR') : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-orange-700">
                            {(req.estimated_amount || 0).toLocaleString()}원
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isSubmitted ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">신청완료</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700">대기</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => handleCopyRefundRow(req)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] bg-[#093687] text-white rounded hover:bg-[#072b6e]"
                                title="신청서 텍스트를 클립보드에 복사"
                              >
                                <Copy className="w-3 h-3" />신청서 복사
                              </button>
                              {!isSubmitted && (
                                <button
                                  onClick={() => handleMarkRefundSubmitted(req)}
                                  className="px-2 py-1 text-[10px] bg-green-500 text-white rounded hover:bg-green-600"
                                  title="네이버에 신청 완료 처리"
                                >
                                  신청완료
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
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">부정클릭 환불 신청</h3>
                <p className="text-sm text-yellow-800">
                  위험도 80점 이상 IP를 자동 수집하여 환불신청서를 생성합니다.
                  {highRiskIps.length > 0
                    ? ` 현재 ${highRiskIps.length}개 고위험 IP, 총 ${highRiskIps.reduce((s, ip) => s + ip.clicks, 0)}클릭, 예상 환불 ${(highRiskIps.reduce((s, ip) => s + ip.clicks, 0) * estimatedCpc).toLocaleString()}원`
                    : ' 현재 고위험 IP가 없습니다.'}
                </p>
              </div>
            </div>
          </div>

          {highRiskIps.length > 0 && (
            <>
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-foreground">고위험 IP 목록 (위험도 80+)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-red-800">IP</th>
                        <th className="text-center px-4 py-2 font-medium text-red-800">클릭수</th>
                        <th className="text-center px-4 py-2 font-medium text-red-800">위험도</th>
                        <th className="text-left px-4 py-2 font-medium text-red-800">키워드</th>
                        <th className="text-right px-4 py-2 font-medium text-red-800">예상환불</th>
                        <th className="text-left px-4 py-2 font-medium text-red-800">최초 감지</th>
                        <th className="text-left px-4 py-2 font-medium text-red-800">최근 감지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {highRiskIps.map(ip => (
                        <tr key={ip.ip} className="border-t bg-red-50/30">
                          <td className="px-4 py-2 font-mono font-medium text-xs">{ip.ip}</td>
                          <td className="px-4 py-2 text-center font-bold text-red-700">{ip.clicks}</td>
                          <td className="px-4 py-2 text-center"><RiskBadge score={ip.riskScore} /></td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{ip.keywords.length > 0 ? ip.keywords.slice(0, 3).join(', ') : '-'}</td>
                          <td className="px-4 py-2 text-right font-medium text-red-600">{(ip.clicks * estimatedCpc).toLocaleString()}원</td>
                          <td className="px-4 py-2 text-xs">{ip.firstSeen ? new Date(ip.firstSeen).toLocaleString('ko-KR') : '-'}</td>
                          <td className="px-4 py-2 text-xs">{ip.lastSeen ? new Date(ip.lastSeen).toLocaleString('ko-KR') : '-'}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-red-300 bg-red-100/50">
                        <td className="px-4 py-2 font-bold text-red-900">합계</td>
                        <td className="px-4 py-2 text-center font-bold text-red-900">{highRiskIps.reduce((s, ip) => s + ip.clicks, 0)}</td>
                        <td colSpan={2}></td>
                        <td className="px-4 py-2 text-right font-bold text-red-900">{(highRiskIps.reduce((s, ip) => s + ip.clicks, 0) * estimatedCpc).toLocaleString()}원</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleCopyRefund}
                  className="flex items-center gap-2 px-4 py-2 bg-[#093687] text-white rounded-lg text-sm hover:bg-[#072b6e]">
                  <Copy className="w-4 h-4" />클립보드 복사
                </button>
                <button onClick={() => window.open('https://help.naver.com/service/5600/category/List', '_blank')}
                  className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm hover:bg-muted/50">
                  <ExternalLink className="w-4 h-4" />네이버 클린센터 열기
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* IP 상세 모달 */}
      {(detailIp || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setDetailIp(null); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />상세 정보 로딩 중...</div>
            ) : detailIp ? (
              <>
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-bold text-foreground font-mono">{detailIp.ip} 상세 정보</h3>
                  <button onClick={() => setDetailIp(null)} className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-muted/30 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">방문</p>
                      <p className="text-lg font-bold">{detailIp.visits || detailIp.count}회</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">평균 체류</p>
                      <p className={`text-lg font-bold ${detailIp.avgDuration > 0 && detailIp.avgDuration < 10 ? 'text-red-600' : ''}`}>
                        {detailIp.avgDuration > 0 ? `${detailIp.avgDuration}초` : '-'}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">위험도</p>
                      <RiskBadge score={detailIp.riskScore || 0} />
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">기기</span><span className="font-medium">{detailIp.device === 'mobile' ? '모바일' : detailIp.device === 'pc' ? 'PC' : '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">스크롤 깊이</span><span className="font-medium">{detailIp.scrollDepth > 0 ? `${detailIp.scrollDepth}%` : '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">유입 키워드</span><span className="font-medium">{detailIp.keywords?.length > 0 ? detailIp.keywords.join(', ') : '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">최초 방문</span><span>{detailIp.firstSeen ? new Date(detailIp.firstSeen).toLocaleString('ko-KR') : '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">최근 방문</span><span>{detailIp.lastSeen ? new Date(detailIp.lastSeen).toLocaleString('ko-KR') : '-'}</span></div>
                  </div>

                  {detailIp.events && detailIp.events.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">행동 기록</p>
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {detailIp.events.map((ev, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px]">
                            <span className="text-muted-foreground shrink-0 w-[55px]">{ev.time ? new Date(ev.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            <span className={`shrink-0 px-1 py-0.5 rounded text-[9px] font-bold ${
                              ev.event === 'visit' ? 'bg-blue-100 text-blue-700' :
                              ev.event === 'click' ? 'bg-green-100 text-green-700' :
                              ev.event === 'call' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{ev.event === 'visit' ? '방문' : ev.event === 'click' ? '클릭' : ev.event === 'call' ? '전화' : '이탈'}</span>
                            <span className="text-muted-foreground">{ev.text || ''}{ev.event === 'leave' && ev.duration != null ? ` (${ev.duration}초)` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">위험 판단 근거</p>
                    <div className="space-y-1 text-xs">
                      {(detailIp.visits || detailIp.count) >= 3 && <p className="text-orange-600">&#x26A0;&#xFE0F; 동일 IP {detailIp.visits || detailIp.count}회 방문</p>}
                      {detailIp.avgDuration > 0 && detailIp.avgDuration < 10 && <p className="text-red-600">&#x26A0;&#xFE0F; 체류시간 너무 짧음 ({detailIp.avgDuration}초)</p>}
                      {detailIp.scrollDepth > 0 && detailIp.scrollDepth < 20 && <p className="text-orange-600">&#x26A0;&#xFE0F; 스크롤 깊이 부족 ({detailIp.scrollDepth}%)</p>}
                      {detailIp.avgDuration >= 30 && <p className="text-green-600">&#x2705; 체류시간 정상 ({detailIp.avgDuration}초)</p>}
                      {detailIp.scrollDepth >= 50 && <p className="text-green-600">&#x2705; 페이지 충분히 열람 ({detailIp.scrollDepth}%)</p>}
                      {detailIp.naver_registered && <p className="text-green-600">&#x2705; 네이버 차단 등록됨</p>}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    {!detailIp.naver_registered && (
                      <button onClick={() => { handleRegisterNaver(detailIp.ip); setDetailIp(null); }}
                        className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600">네이버 등록</button>
                    )}
                    <button onClick={() => setDetailIp(null)}
                      className="flex-1 px-3 py-2 bg-white border rounded-lg text-xs hover:bg-muted/50">닫기</button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
