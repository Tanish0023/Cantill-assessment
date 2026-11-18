import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Layers, ShieldCheck, FileText, Users, Building, AlertCircle } from 'lucide-react';

interface MetricsBarProps {
  stats: any;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ stats }) => {
  if (!stats) return null;

  const items = [
    { label: 'Total PR Lines', value: stats.pr_lines || 0, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Policies', value: stats.policies || 1, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Rate Contracts', value: stats.contracts || 0, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Approved Suppliers', value: stats.suppliers || 0, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Item Catalog', value: stats.items || 0, icon: Building, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {items.map((it, idx) => {
        const Icon = it.icon;
        return (
          <Card key={idx} className="border-slate-200 shadow-xs">
            <CardContent className="p-3.5 flex items-center space-x-3">
              <div className={`p-2.5 rounded-lg ${it.bg} ${it.color} shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate">
                  {it.label}
                </p>
                <p className="text-lg font-bold text-slate-900 leading-tight">
                  {it.value.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
