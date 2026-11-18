import React, { useState, useEffect } from 'react';
import { 
  Award, Search, Calendar, Download, Building, 
  CheckCircle2, Clock, ShieldCheck, Tag, HelpCircle, ExternalLink
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import * as api from '@/lib/api';

interface RankingsScreenProps {
  showNotification: (msg: string, type?: 'success' | 'error') => void;
}

export const RankingsScreen: React.FC<RankingsScreenProps> = ({ showNotification }) => {
  const [items, setItems] = useState<any[]>([]);
  const [selectedItemCode, setSelectedItemCode] = useState('ITM-1048');
  const [asOfDate, setAsOfDate] = useState('2026-11-01');
  const [topN, setTopN] = useState<number>(5);
  const [rankingsData, setRankingsData] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Common items from Worked Examples for easy testing
  const quickTestItems = [
    { code: 'ITM-1048', name: 'Nitrile coated gloves (Worked Example)' },
    { code: 'ITM-1036', name: 'Pneumatic cylinder 50x100 (Worked Example)' },
    { code: 'ITM-1009', name: 'Hex bolt M10x40 GR 8.8' },
    { code: 'ITM-1022', name: 'Ball bearing 6308-ZZ' },
    { code: 'ITM-1038', name: 'Hydraulic oil HLP 68' }
  ];

  const loadItems = async () => {
    try {
      const data = await api.fetchItems();
      setItems(data || []);
    } catch (err: any) {
      console.error('Failed to load items:', err);
    }
  };

  const loadRankings = async () => {
    setLoading(true);
    try {
      const [rData, sData] = await Promise.all([
        api.fetchRankings(asOfDate, selectedItemCode, topN),
        api.fetchSourcingSuggestions(selectedItemCode, asOfDate, 5).catch(() => ({ suggestions: [] }))
      ]);
      setRankingsData(rData);
      setSuggestions(sData?.suggestions || []);
    } catch (err: any) {
      showNotification('Failed to calculate rankings: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    loadRankings();
  }, [selectedItemCode, asOfDate, topN]);

  const handleExportCSV = () => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/rankings/export?as_of_date=${asOfDate}&top_n=${topN}`;
    window.open(url, '_blank');
    showNotification('Supplier rankings CSV export initiated', 'success');
  };

  const rankedList = rankingsData?.rankings || [];

  return (
    <div className="space-y-5">
      {/* Mathematical Formula Explanation Banner */}
      <Card className="border-slate-200 bg-slate-50/70 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-slate-900 flex items-center">
                <ShieldCheck className="w-4 h-4 text-blue-600 mr-1.5" />
                Policy Section 6: Preferred Supplier Composite Scoring Formulation
              </span>
              <p className="font-mono text-slate-700 bg-white px-2.5 py-1.5 rounded border border-slate-200 inline-block text-[11px]">
                Score = (0.30 × Freq) + (0.25 × Recency) + (0.20 × Contract) + (0.15 × OTD%) + (0.10 × Quality)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="text-xs h-8 bg-white border-slate-300"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-slate-600" />
              Export Rankings CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Query Parameters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          {/* Item Selector */}
          <div className="sm:col-span-6">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Select Item Catalog Code
            </label>
            <select
              value={selectedItemCode}
              onChange={(e) => setSelectedItemCode(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              {items.map((it) => (
                <option key={it.item_code} value={it.item_code}>
                  {it.item_code} - {it.description}
                </option>
              ))}
            </select>
          </div>

          {/* As-Of Date Picker */}
          <div className="sm:col-span-3">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              As-Of Evaluation Date
            </label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Top N */}
          <div className="sm:col-span-3">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Top Suppliers Count
            </label>
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>All Candidates</option>
            </select>
          </div>
        </div>

        {/* Quick Test Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Worked Examples:</span>
          {quickTestItems.map((q) => (
            <button
              key={q.code}
              onClick={() => setSelectedItemCode(q.code)}
              className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${
                selectedItemCode === q.code
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {q.code} ({q.name.split(' ')[0]})
            </button>
          ))}
        </div>
      </div>

      {/* Main Ranking Table */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="py-3.5 px-4 bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center">
              <Award className="w-4 h-4 text-amber-500 mr-2" />
              Ranked Preferred Suppliers for {selectedItemCode}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Evaluated as of <span className="font-semibold text-slate-700">{asOfDate}</span> (Excludes Inactive/Blocked suppliers)
            </CardDescription>
          </div>
          {rankingsData?.item_description && (
            <Badge variant="outline" className="font-semibold text-slate-800">
              {rankingsData.item_description}
            </Badge>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-medium">Computing historical POs, contracts, and supplier metrics...</p>
            </div>
          ) : rankedList.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Award className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">No qualified suppliers with transaction history.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Category fallback will provide sourcing suggestions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3 w-16">Rank</th>
                    <th className="p-3">Supplier Name & ID</th>
                    <th className="p-3">Composite Score</th>
                    <th className="p-3">PO Count (548d)</th>
                    <th className="p-3">Recency Factor</th>
                    <th className="p-3">Contract Held</th>
                    <th className="p-3">OTD %</th>
                    <th className="p-3">Quality Rating</th>
                    <th className="p-3 text-right">Reference Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rankedList.map((cand: any, idx: number) => {
                    const b = cand.breakdown || {};
                    const isRank1 = cand.rank === 1;

                    return (
                      <tr
                        key={cand.supplier_id}
                        className={`hover:bg-slate-50 transition-colors ${
                          isRank1 ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                              isRank1
                                ? 'bg-amber-500 text-white shadow-xs'
                                : cand.rank === 2
                                ? 'bg-slate-300 text-slate-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            #{cand.rank}
                          </span>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <span className="font-bold text-slate-900 block text-xs">
                            {cand.supplier_name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {cand.supplier_id}
                          </span>
                        </td>

                        <td className="p-3 whitespace-nowrap w-44">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-bold text-slate-900">
                              {(cand.score * 100).toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {cand.score?.toFixed(4)}
                            </span>
                          </div>
                          <Progress value={cand.score * 100} className="h-1.5" />
                        </td>

                        <td className="p-3 whitespace-nowrap font-medium text-slate-800">
                          {b.po_count} POs
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <Badge
                            variant={cand.recency === 1.0 ? 'success' : cand.recency === 0.5 ? 'warning' : 'secondary'}
                            className="text-[10px]"
                          >
                            {cand.recency === 1.0 ? '≤ 90d (1.0)' : cand.recency === 0.5 ? '≤ 365d (0.5)' : '> 1yr (0.0)'}
                          </Badge>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <Badge
                            variant={cand.has_contract ? 'info' : 'outline'}
                            className="text-[10px]"
                          >
                            {cand.has_contract ? 'Contracted' : 'None'}
                          </Badge>
                        </td>

                        <td className="p-3 whitespace-nowrap font-semibold text-slate-800">
                          {cand.on_time_pct}%
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{cand.quality_rating}</span>
                          <span className="text-[10px] text-slate-400"> / 5.0</span>
                        </td>

                        <td className="p-3 whitespace-nowrap text-right font-bold text-slate-900 font-mono">
                          ₹{cand.reference_price?.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Fallback Sourcing Candidates */}
      {suggestions.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/20 shadow-xs">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-purple-950 flex items-center">
                  <Tag className="w-3.5 h-3.5 text-purple-600 mr-1.5" />
                  Recommended Sourcing Suggestions (RFQ/RFP Pipeline)
                </span>
                <p className="text-[11px] text-purple-800">
                  Combines preferred ranked suppliers with category-level fallback to guarantee required quotes:
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((sId, idx) => (
                  <Badge key={idx} variant="outline" className="bg-white border-purple-300 font-mono font-bold text-purple-900 text-xs px-2.5 py-1 shadow-2xs">
                    #{idx + 1} {sId}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
