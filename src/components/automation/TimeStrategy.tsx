import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { AdTimeStrategyRow, TimeStrategyGrid } from '@/lib/types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

const STRATEGIES = {
  aggressive: { label: '2x', shortLabel: '2x', color: 'bg-red-500', textColor: 'text-white', multiplier: 2.0 },
  normal: { label: '1x', shortLabel: '1x', color: 'bg-blue-400', textColor: 'text-white', multiplier: 1.0 },
  conservative: { label: '0.5x', shortLabel: '.5', color: 'bg-green-400', textColor: 'text-white', multiplier: 0.5 },
  off: { label: 'OFF', shortLabel: '-', color: 'bg-gray-200', textColor: 'text-gray-400', multiplier: 0 },
} as const;

type StrategyType = keyof typeof STRATEGIES;

interface TimeStrategyProps {
  adAccountId: string | undefined;
}

function createDefaultGrid(): TimeStrategyGrid {
  const grid: TimeStrategyGrid = {};
  for (const h of HOURS) {
    grid[String(h)] = {};
    for (const d of DAYS) {
      grid[String(h)][d] = 'normal';
    }
  }
  return grid;
}

export default function TimeStrategy({ adAccountId }: TimeStrategyProps) {
  const [strategy, setStrategy] = useState<AdTimeStrategyRow | null>(null);
  const [grid, setGrid] = useState<TimeStrategyGrid>(createDefaultGrid);
  const [isEnabled, setIsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paintMode, setPaintMode] = useState<StrategyType>('normal');
  const [isDragging, setIsDragging] = useState(false);

  const fetchStrategy = useCallback(async () => {
    if (!adAccountId) return;
    const { data } = await supabase
      .from('ad_time_strategy')
      .select('*')
      .eq('ad_account_id', adAccountId)
      .maybeSingle();

    if (data) {
      const row = data as AdTimeStrategyRow;
      setStrategy(row);
      setIsEnabled(row.is_enabled);
      if (row.strategy_grid) setGrid(row.strategy_grid);
    }
  }, [adAccountId]);

  useEffect(() => {
    fetchStrategy();
  }, [fetchStrategy]);

  const handleCellClick = (hour: number, day: string) => {
    setGrid(prev => ({
      ...prev,
      [String(hour)]: { ...prev[String(hour)], [day]: paintMode },
    }));
  };

  const handleCellEnter = (hour: number, day: string) => {
    if (!isDragging) return;
    handleCellClick(hour, day);
  };

  const handleFillAll = (type: StrategyType) => {
    const newGrid: TimeStrategyGrid = {};
    for (const h of HOURS) {
      newGrid[String(h)] = {};
      for (const d of DAYS) {
        newGrid[String(h)][d] = type;
      }
    }
    setGrid(newGrid);
  };

  const handleFillWeekday = () => {
    setGrid(prev => {
      const newGrid = { ...prev };
      for (const h of HOURS) {
        newGrid[String(h)] = { ...newGrid[String(h)] };
        for (const d of DAYS.slice(0, 5)) {
          newGrid[String(h)][d] = paintMode;
        }
      }
      return newGrid;
    });
  };

  const handleFillWeekend = () => {
    setGrid(prev => {
      const newGrid = { ...prev };
      for (const h of HOURS) {
        newGrid[String(h)] = { ...newGrid[String(h)] };
        for (const d of DAYS.slice(5)) {
          newGrid[String(h)][d] = paintMode;
        }
      }
      return newGrid;
    });
  };

  const handleSave = async () => {
    if (!adAccountId) return;
    setSaving(true);
    try {
      if (strategy) {
        await supabase.from('ad_time_strategy').update({
          is_enabled: isEnabled,
          strategy_grid: grid,
        }).eq('id', strategy.id);
      } else {
        await supabase.from('ad_time_strategy').insert({
          ad_account_id: adAccountId,
          is_enabled: isEnabled,
          strategy_grid: grid,
        });
      }
      await fetchStrategy();
      toast.success('시간대 전략 저장됨');
    } catch (e) {
      toast.error('저장 실패');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" />시간대별 입찰 배율
        </h3>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <div className={`relative w-10 h-5 rounded-full transition-colors ${isEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={e => setIsEnabled(e.target.checked)}
              className="sr-only"
            />
            <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5 ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <span className={isEnabled ? 'text-foreground' : 'text-muted-foreground'}>
            {isEnabled ? '활성' : '비활성'}
          </span>
        </label>
      </div>

      {/* Paint Mode + Quick Fill */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">브러시:</span>
        {(Object.entries(STRATEGIES) as [StrategyType, typeof STRATEGIES[StrategyType]][]).map(([key, s]) => (
          <button
            key={key}
            onClick={() => setPaintMode(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${s.color} ${s.textColor} ${
              paintMode === key ? 'ring-2 ring-offset-1 ring-blue-500 scale-105' : 'opacity-60 hover:opacity-80'
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="text-muted-foreground mx-1">|</span>
        <button onClick={handleFillWeekday} className="px-2 py-1 text-[10px] border rounded hover:bg-muted/50">평일 전체</button>
        <button onClick={handleFillWeekend} className="px-2 py-1 text-[10px] border rounded hover:bg-muted/50">주말 전체</button>
        <button onClick={() => handleFillAll('normal')} className="px-2 py-1 text-[10px] border rounded hover:bg-muted/50">전체 초기화</button>
      </div>

      {/* Heatmap Grid */}
      <div
        className="overflow-x-auto select-none"
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        <table className="text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="px-1 py-1 text-muted-foreground font-medium sticky left-0 bg-white z-10">시간</th>
              {DAYS.map(d => (
                <th key={d} className="px-0.5 py-1 text-muted-foreground font-medium w-9 text-center">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(h => (
              <tr key={h}>
                <td className="px-1 py-0 text-muted-foreground text-right pr-1.5 font-mono sticky left-0 bg-white z-10">
                  {String(h).padStart(2, '0')}
                </td>
                {DAYS.map(d => {
                  const cellValue = (grid[String(h)]?.[d] || 'normal') as StrategyType;
                  const style = STRATEGIES[cellValue];
                  return (
                    <td
                      key={d}
                      onMouseDown={() => handleCellClick(h, d)}
                      onMouseEnter={() => handleCellEnter(h, d)}
                      className={`w-9 h-6 text-center cursor-pointer border border-white/50 ${style.color} ${style.textColor} hover:brightness-110 transition-all`}
                    >
                      {style.shortLabel}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground">
        클릭 또는 드래그로 시간대별 배율 설정. 2x=공격적, 1x=보통, 0.5x=절약, OFF=입찰중지
      </p>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-[#093687] text-white rounded-lg text-sm hover:bg-[#072b6e] transition-colors disabled:opacity-50"
      >
        <Save className="w-4 h-4" />{saving ? '저장 중...' : '저장'}
      </button>
    </div>
  );
}
