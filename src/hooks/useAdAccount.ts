import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { AdAccount, AdAccountRow, AdGroupSetting, AdGroupSettingRow } from '@/lib/types';

function rowToAccount(row: AdAccountRow): AdAccount {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    naverCustomerId: row.naver_customer_id,
    naverApiKeyEncrypted: row.naver_api_key_encrypted ?? undefined,
    naverSecretKeyEncrypted: row.naver_secret_key_encrypted ?? undefined,
    targetCpa: row.target_cpa,
    dailyBudget: row.daily_budget,
    strategy: row.strategy as AdAccount['strategy'],
    isActive: row.is_active,
    isAuto: row.is_auto ?? false,
    targetCampaignId: row.target_campaign_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToGroupSetting(row: AdGroupSettingRow): AdGroupSetting {
  return {
    id: row.id,
    adAccountId: row.ad_account_id,
    groupName: row.group_name,
    targetCpa: row.target_cpa,
    maxBid: row.max_bid,
    minBid: row.min_bid,
    targetRank: row.target_rank,
    dailyBudget: row.daily_budget,
    isAuto: row.is_auto,
    createdAt: row.created_at,
  };
}

export function useAdAccount() {
  const { user } = useAuth();
  const [account, setAccount] = useState<AdAccount | null>(null);
  const [groupSettings, setGroupSettings] = useState<AdGroupSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccount = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ad_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const acc = rowToAccount(data as AdAccountRow);
        setAccount(acc);

        const { data: groups } = await supabase
          .from('ad_group_settings')
          .select('*')
          .eq('ad_account_id', acc.id)
          .order('created_at');
        setGroupSettings((groups || []).map(g => rowToGroupSetting(g as AdGroupSettingRow)));
      }
    } catch (e) {
      console.error('광고 계정 조회 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const createAccount = async (name: string): Promise<AdAccount | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('ad_accounts')
      .insert({ user_id: user.id, name })
      .select()
      .single();
    if (error) throw error;
    const acc = rowToAccount(data as AdAccountRow);
    setAccount(acc);
    return acc;
  };

  const updateAccount = async (updates: Partial<AdAccountRow>): Promise<void> => {
    if (!account) return;
    const { error } = await supabase
      .from('ad_accounts')
      .update(updates)
      .eq('id', account.id);
    if (error) throw error;
    await fetchAccount();
  };

  const saveApiKeys = async (
    customerId: string,
    apiKey: string,
    secretKey: string
  ): Promise<void> => {
    if (!account) return;
    await updateAccount({
      naver_customer_id: customerId,
      naver_api_key_encrypted: apiKey,
      naver_secret_key_encrypted: secretKey,
    } as Partial<AdAccountRow>);
  };

  const saveGroupSetting = async (setting: Omit<AdGroupSettingRow, 'id' | 'created_at'>): Promise<void> => {
    if (!account) return;
    const existing = groupSettings.find(g => g.groupName === setting.group_name);
    if (existing) {
      await supabase.from('ad_group_settings').update(setting).eq('id', existing.id);
    } else {
      await supabase.from('ad_group_settings').insert({ ...setting, ad_account_id: account.id });
    }
    await fetchAccount();
  };

  return {
    account,
    groupSettings,
    loading,
    createAccount,
    updateAccount,
    saveApiKeys,
    saveGroupSetting,
    refreshAccount: fetchAccount,
  };
}
