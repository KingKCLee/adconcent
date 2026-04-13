import { useState, useCallback } from 'react';
import * as naverApi from '@/lib/naverApi';
import type { NaverCampaign, NaverAdGroup, NaverKeyword } from '@/lib/types';

export function useNaverApi(adAccountId: string | undefined) {
  const [campaigns, setCampaigns] = useState<NaverCampaign[]>([]);
  const [adGroups, setAdGroups] = useState<NaverAdGroup[]>([]);
  const [keywords, setKeywords] = useState<NaverKeyword[]>([]);
  const [bizMoney, setBizMoney] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!adAccountId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await naverApi.fetchCampaignsCached(adAccountId, (fresh) => setCampaigns(fresh));
      setCampaigns(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adAccountId]);

  const fetchAdGroups = useCallback(async (campaignId: string) => {
    if (!adAccountId) return;
    setLoading(true);
    try {
      const data = await naverApi.fetchAdGroupsCached(adAccountId, campaignId, (fresh) => setAdGroups(fresh));
      setAdGroups(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adAccountId]);

  const fetchKeywords = useCallback(async (adGroupId: string) => {
    if (!adAccountId) return;
    setLoading(true);
    try {
      const data = await naverApi.fetchKeywordsCached(adAccountId, adGroupId, (fresh) => setKeywords(fresh));
      setKeywords(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adAccountId]);

  const refreshCampaigns = useCallback(async () => {
    if (!adAccountId) return;
    await naverApi.invalidateCampaignsCache(adAccountId);
    return fetchCampaigns();
  }, [adAccountId, fetchCampaigns]);

  const refreshAdGroups = useCallback(async (campaignId: string) => {
    if (!adAccountId) return;
    await naverApi.invalidateAdGroupsCache(adAccountId, campaignId);
    return fetchAdGroups(campaignId);
  }, [adAccountId, fetchAdGroups]);

  const refreshKeywords = useCallback(async (adGroupId: string) => {
    if (!adAccountId) return;
    await naverApi.invalidateKeywordsCache(adAccountId, adGroupId);
    return fetchKeywords(adGroupId);
  }, [adAccountId, fetchKeywords]);

  const fetchBizMoney = useCallback(async () => {
    if (!adAccountId) return;
    try {
      const amount = await naverApi.fetchBizMoney(adAccountId);
      setBizMoney(amount);
    } catch {
      // silent
    }
  }, [adAccountId]);

  const updateBid = useCallback(async (keywordId: string, bidAmt: number) => {
    if (!adAccountId) return false;
    return naverApi.updateKeywordBid(adAccountId, keywordId, bidAmt);
  }, [adAccountId]);

  const testConnection = useCallback(async () => {
    if (!adAccountId) return { success: false, message: '계정이 없습니다.' };
    return naverApi.testConnection(adAccountId);
  }, [adAccountId]);

  return {
    campaigns,
    adGroups,
    keywords,
    bizMoney,
    loading,
    error,
    fetchCampaigns,
    fetchAdGroups,
    fetchKeywords,
    refreshCampaigns,
    refreshAdGroups,
    refreshKeywords,
    fetchBizMoney,
    updateBid,
    testConnection,
    setKeywords, // 낙관적 업데이트용 (UI 즉시 반영 / 실패 시 롤백)
  };
}
