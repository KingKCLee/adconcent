import { useState } from 'react';
import { Search, Plus, Loader2 } from 'lucide-react';

interface KeywordExpandProps {
  adAccountId: string | undefined;
}

interface SuggestedKeyword {
  keyword: string;
  monthlySearchCount: number;
  competitionLevel: 'high' | 'medium' | 'low';
  suggestedBid: number;
}

export default function KeywordExpand({ adAccountId }: KeywordExpandProps) {
  const [seedKeyword, setSeedKeyword] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedKeyword[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!seedKeyword.trim()) return;
    setLoading(true);
    // 네이버 키워드 도구 API 연동 예정
    // 현재는 placeholder
    setTimeout(() => {
      setSuggestions([]);
      setLoading(false);
    }, 1000);
  };

  const competitionLabels = {
    high: { text: '높음', color: 'text-red-600 bg-red-100' },
    medium: { text: '보통', color: 'text-yellow-600 bg-yellow-100' },
    low: { text: '낮음', color: 'text-green-600 bg-green-100' },
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">키워드 추천</h3>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="시드 키워드 입력 (예: 분양)"
            value={seedKeyword}
            onChange={e => setSeedKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !seedKeyword.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-[#093687] text-white rounded-lg text-sm hover:bg-[#072b6e] transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          검색
        </button>
      </div>

      {suggestions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">키워드</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">월검색량</th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">경쟁도</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">추천 입찰가</th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">추가</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s, i) => (
                <tr key={i} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{s.keyword}</td>
                  <td className="px-4 py-2.5 text-right">{s.monthlySearchCount.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${competitionLabels[s.competitionLevel].color}`}>
                      {competitionLabels[s.competitionLevel].text}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">{s.suggestedBid.toLocaleString()}원</td>
                  <td className="px-4 py-2.5 text-center">
                    <button className="p-1 text-blue-500 hover:text-blue-700">
                      <Plus className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {loading ? '키워드를 검색 중...' : '시드 키워드를 입력하고 검색하세요. 네이버 키워드 도구 API 연동 후 활성화됩니다.'}
        </div>
      )}
    </div>
  );
}
