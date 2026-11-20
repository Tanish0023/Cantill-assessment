import React from 'react';
import { 
  Building2, MessageSquare, Layers, FileText, 
  Award, ShieldCheck, FileCheck, Clock, RefreshCw 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  stats: any;
  onRefresh: () => void;
  loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  stats,
  onRefresh,
  loading
}) => {
  const navItems = [
    { id: 'chat', label: 'Chat PR Intake', icon: MessageSquare },
    { id: 'workspace', label: 'Buyer Dashboard', icon: Layers, count: stats?.purchase_requests },
    { id: 'batch', label: 'PR Batch Processing', icon: FileCheck },
    { id: 'policies', label: 'Policy Management', icon: ShieldCheck, count: stats?.policies },
    { id: 'rankings', label: 'Supplier Rankings', icon: Award },
    { id: 'contracts', label: 'Contract Ceilings', icon: FileText, count: stats?.contracts },
    { id: 'audit', label: 'Audit Trail', icon: Clock },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="bg-slate-900 text-white p-2 rounded-lg flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">CORVO</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wide">
                  Procurement AI
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Policy v{stats?.active_policy_version || '5.0'} Decision Engine
              </p>
            </div>
          </div>

          {/* Quick stats & Refresh */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>PostgreSQL & Engine Active</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="h-8 text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 overflow-x-auto py-2 -mb-px scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-slate-700 text-slate-100' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
