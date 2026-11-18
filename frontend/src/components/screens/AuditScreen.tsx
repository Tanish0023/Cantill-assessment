import React, { useState, useEffect } from 'react';
import { 
  Clock, Search, Filter, ShieldCheck, UserCheck, 
  AlertTriangle, RefreshCw, FileText, ChevronDown, ChevronRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import * as api from '@/lib/api';

interface AuditScreenProps {
  showNotification: (msg: string, type?: 'success' | 'error') => void;
}

export const AuditScreen: React.FC<AuditScreenProps> = ({ showNotification }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await api.fetchAuditLogs();
      setLogs(data || []);
    } catch (err: any) {
      showNotification('Failed to load audit logs: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const filtered = logs.filter((l) => {
    const term = search.toLowerCase();
    const matchesSearch =
      !search ||
      l.entity_id?.toLowerCase().includes(term) ||
      l.action?.toLowerCase().includes(term) ||
      l.performed_by?.toLowerCase().includes(term) ||
      l.comment?.toLowerCase().includes(term);

    const matchesType = typeFilter === 'ALL' || l.entity_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-5">
      {/* Overview Banner */}
      <Card className="border-slate-200 bg-slate-50/70 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900 flex items-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mr-1.5" />
                Immutable Procurement Audit Trail
              </span>
              <p className="text-slate-600">
                Chronological log capturing automated evaluations, buyer approvals, overrides with mandatory justification, and policy revisions.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadAuditLogs} disabled={loading} className="text-xs h-8 bg-white">
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, actor, comment, or entity ID..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">All Entity Types</option>
            <option value="DECISION">Decisions</option>
            <option value="POLICY">Policy Amendments</option>
            <option value="PR">Purchase Requests</option>
            <option value="CONTRACT">Contracts</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-medium">Retrieving audit event stream...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">No audit events match your filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3 w-10"></th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Entity Type</th>
                    <th className="p-3">Entity ID</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Performed By</th>
                    <th className="p-3">Audit Details & Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((log) => {
                    const isExpanded = expandedRow === log.id;
                    const isOverride = log.action?.includes('OVERRIDE');
                    const isApprove = log.action?.includes('APPROVE');

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center">
                            {log.payload_json ? (
                              <button
                                onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                                className="text-slate-400 hover:text-slate-700"
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            ) : null}
                          </td>

                          <td className="p-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {log.timestamp}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {log.entity_type}
                            </Badge>
                          </td>

                          <td className="p-3 whitespace-nowrap font-mono font-bold text-slate-800">
                            {log.entity_id}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <Badge
                              variant={isApprove ? 'success' : isOverride ? 'warning' : 'secondary'}
                              className="text-[10px] font-bold"
                            >
                              {log.action}
                            </Badge>
                          </td>

                          <td className="p-3 whitespace-nowrap font-medium text-slate-800">
                            {log.performed_by || 'System Engine'}
                          </td>

                          <td className="p-3 text-slate-700">
                            <p className="line-clamp-2">{log.comment}</p>
                          </td>
                        </tr>

                        {isExpanded && log.payload_json && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={7} className="p-3 pl-12">
                              <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono">
                                <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                                  Structured Payload JSON
                                </span>
                                <pre className="text-[11px] text-slate-700 overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.payload_json, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
