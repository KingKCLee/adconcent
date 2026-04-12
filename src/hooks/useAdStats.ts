import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AdReport, AdReportRow, AdBidLog, AdBidLogRow } from '@/lib/types';

function rowToReport(row: AdReportRow): AdReport {
  return {
    id: row.id,
    adAccountId: row.ad_account_id,
    reportDate: row.report_date,
    impressions: row.impressions,
    clicks: row.clicks,
    cost: row.cost,
    conversions: row.conversions,
    cpa: row.cpa,
    ctr: row.ctr,
    cpc: row.cpc,
    bidChanges: row.bid_changes,
    ipBlocked: row.ip_blocked,
    details: row.details,
    createdAt: row.created_at,
  };
}

function rowToBidLog(row: AdBidLogRow): AdBidLog {
  return {
    id: row.id,
    adAccountId: row.ad_account_id,
    strategy: row.strategy,
    totalKeywords: row.total_keywords,
    totalChanged: row.total_changed,
    totalSkipped: row.total_skipped,
    avgBid: row.avg_bid,
    elapsedMs: row.elapsed_ms,
    details: row.details,
    createdAt: row.created_at,
  };
}

export type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'year';

function getDateRange(range: DateRange): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  let from: string;

  switch (range) {
    case 'today':
      from = to;
      break;
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      from = y.toISOString().split('T')[0];
      break;
    }
    case '7days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      from = d.toISOString().split('T')[0];
      break;
    }
    case '30days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      from = d.toISOString().split('T')[0];
      break;
    }
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      break;
    case 'year':
      from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      break;
  }

  return { from, to };
}

export function useAdStats(adAccountId: string | undefined) {
  const [reports, setReports] = useState<AdReport[]>([]);
  const [bidLogs, setBidLogs] = useState<AdBidLog[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [loading, setLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!adAccountId) return;
    setLoading(true);
    try {
      const { from, to } = getDateRange(dateRange);
      const { data, error } = await supabase
        .from('ad_reports')
        .select('*')
        .eq('ad_account_id', adAccountId)
        .gte('report_date', from)
        .lte('report_date', to)
        .order('report_date', { ascending: true });

      if (error) throw error;
      setReports((data || []).map(r => rowToReport(r as AdReportRow)));
    } catch (e) {
      console.error('보고서 조회 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [adAccountId, dateRange]);

  const fetchBidLogs = useCallback(async () => {
    if (!adAccountId) return;
    try {
      const { data, error } = await supabase
        .from('ad_bid_logs')
        .select('*')
        .eq('ad_account_id', adAccountId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setBidLogs((data || []).map(l => rowToBidLog(l as AdBidLogRow)));
    } catch (e) {
      console.error('입찰 로그 조회 실패:', e);
    }
  }, [adAccountId]);

  useEffect(() => {
    fetchReports();
    fetchBidLogs();
  }, [fetchReports, fetchBidLogs]);

  const totals = reports.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      cost: acc.cost + r.cost,
      conversions: acc.conversions + r.conversions,
      bidChanges: acc.bidChanges + r.bidChanges,
      ipBlocked: acc.ipBlocked + r.ipBlocked,
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0, bidChanges: 0, ipBlocked: 0 }
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? Math.round(totals.cost / totals.clicks) : 0;
  const cpa = totals.conversions > 0 ? Math.round(totals.cost / totals.conversions) : 0;

  return {
    reports,
    bidLogs,
    dateRange,
    setDateRange,
    loading,
    totals: { ...totals, ctr, cpc, cpa },
    refresh: () => { fetchReports(); fetchBidLogs(); },
  };
}
