import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Notification {
  id: string;
  level: 'urgent' | 'warn' | 'info';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface HitAdStore {
  selectedDateRange: string;
  setSelectedDateRange: (v: string) => void;
  selectedCampaignId: string;
  setSelectedCampaignId: (v: string) => void;
  selectedKwCampaignId: string;
  setSelectedKwCampaignId: (v: string) => void;
  selectedAdgroupId: string;
  setSelectedAdgroupId: (v: string) => void;
  keywordSearch: string;
  setKeywordSearch: (v: string) => void;
  selectedStrategy: string;
  setSelectedStrategy: (v: string) => void;
  ipTab: string;
  setIpTab: (v: string) => void;
  // 알림
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  // 온보딩
  onboardingDone: boolean;
  setOnboardingDone: (v: boolean) => void;
  // 노출 진단 요약 (대시보드 위젯에서 사용)
  exposureSummary: { normal: number; warning: number; error: number } | null;
  setExposureSummary: (v: { normal: number; warning: number; error: number } | null) => void;
}

export const useAdStore = create<HitAdStore>()(
  persist(
    (set) => ({
      selectedDateRange: '7days',
      setSelectedDateRange: (v) => set({ selectedDateRange: v }),
      selectedCampaignId: '',
      setSelectedCampaignId: (v) => set({ selectedCampaignId: v }),
      selectedKwCampaignId: '',
      setSelectedKwCampaignId: (v) => set({ selectedKwCampaignId: v }),
      selectedAdgroupId: '',
      setSelectedAdgroupId: (v) => set({ selectedAdgroupId: v }),
      keywordSearch: '',
      setKeywordSearch: (v) => set({ keywordSearch: v }),
      selectedStrategy: 'target_rank',
      setSelectedStrategy: (v) => set({ selectedStrategy: v }),
      ipTab: 'detected',
      setIpTab: (v) => set({ ipTab: v }),
      // 알림
      notifications: [],
      addNotification: (n) => set((s) => ({
        notifications: [{ ...n, id: Date.now().toString(), read: false, createdAt: new Date().toISOString() }, ...s.notifications].slice(0, 50),
      })),
      markRead: (id) => set((s) => ({
        notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      })),
      markAllRead: () => set((s) => ({
        notifications: s.notifications.map(n => ({ ...n, read: true })),
      })),
      clearNotifications: () => set({ notifications: [] }),
      // 온보딩
      onboardingDone: false,
      setOnboardingDone: (v) => set({ onboardingDone: v }),
      // 노출 진단 요약
      exposureSummary: null,
      setExposureSummary: (v) => set({ exposureSummary: v }),
    }),
    { name: 'hitad-store' }
  )
);
