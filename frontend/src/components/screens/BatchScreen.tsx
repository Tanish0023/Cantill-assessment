import React, { useState } from 'react';
import { 
  FileCheck, Upload, Download, Search, Play, 
  CheckCircle2, AlertTriangle, Layers, Clock, Filter, FileText
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import * as api from '@/lib/api';

interface BatchScreenProps {
  showNotification: (msg: string, type?: 'success' | 'error') => void;
}

export const BatchScreen: React.FC<BatchScreenProps> = ({ showNotification }) => {
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [policyVersion, setPolicyVersion] = useState('');
  const [processing, setProcessing] = useState(false);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('ALL');
  const [routeFilter, setRouteFilter] = useState('ALL');

  const handleProcessUploaded = async () => {
    if (!batchFile) {
      showNotification('Please select a PR batch CSV file.', 'error');
      return;
    }
    setProcessing(true);
    try {
      const res = await api.processBatchCSV(batchFile, policyVersion || undefined, true);
      setBatchResults(res.results || res || []);
      showNotification(`Batch processed successfully! Evaluated ${res.total_lines || res.length || 0} PR lines.`, 'success');
    } catch (err: any) {
      showNotification('Batch evaluation failed: ' + err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleRunSampleBatch = async () => {
    setProcessing(true);
    try {
      const res = await api.runSampleBatch(policyVersion || undefined);
      setBatchResults(res.results || res || []);
      showNotification(`Evaluated sample PR batch: ${res.total_lines || res.length || 0} lines!`, 'success');
    } catch (err: any) {
      showNotification('Failed to evaluate sample batch: ' + err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleExportCSV = () => {
    if (batchResults.length === 0) {
      showNotification('No batch results to export. Run an evaluation first.', 'error');
      return;
    }

    const headers = [
      "pr_no", "pr_line", "resolved_item_code", "group_id", "po_id",
      "decision", "route", "supplier_id", "unit_price", "group_value_inr",
      "suggested_supplier_ids", "policy_version", "reason"
    ];

    const csvRows = [headers.join(",")];
    for (const r of batchResults) {
      const row = [
        `"${r.pr_no || ''}"`,
        `"${r.pr_line || ''}"`,
        `"${r.resolved_item_code || ''}"`,
        `"${r.group_id || ''}"`,
        `"${r.po_id || ''}"`,
        `"${r.decision || ''}"`,
        `"${r.route || ''}"`,
        `"${r.supplier_id || ''}"`,
        `"${r.unit_price !== undefined && r.unit_price !== '' ? Number(r.unit_price).toFixed(2) : ''}"`,
        `"${r.group_value_inr !== undefined && r.group_value_inr !== '' ? Number(r.group_value_inr).toFixed(2) : ''}"`,
        `"${r.suggested_supplier_ids || ''}"`,
        `"${r.policy_version || ''}"`,
        `"${(r.reason || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(","));
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `corvo_decisions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("Decision CSV exported successfully!", "success");
  };

  const filtered = batchResults.filter((r) => {
    const term = search.toLowerCase();
    const matchesSearch =
      !search ||
      r.pr_no?.toLowerCase().includes(term) ||
      r.resolved_item_code?.toLowerCase().includes(term) ||
      r.group_id?.toLowerCase().includes(term) ||
      r.po_id?.toLowerCase().includes(term) ||
      r.supplier_id?.toLowerCase().includes(term);

    const matchesDecision = decisionFilter === 'ALL' || r.decision === decisionFilter;
    const matchesRoute = routeFilter === 'ALL' || r.route === routeFilter;

    return matchesSearch && matchesDecision && matchesRoute;
  });

  const poCount = batchResults.filter(r => r.decision === 'PO').length;
  const sourcingCount = batchResults.filter(r => r.decision === 'SOURCING_REQUEST').length;
  const consolidatedPOCount = new Set(batchResults.map(r => r.po_id).filter(Boolean)).size;

  return (
    <div className="space-y-5">
      {/* Action / Upload Card */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center">
                <FileCheck className="w-4 h-4 text-blue-600 mr-2" />
                PR Batch Ingestion & 13-Column Evaluation Engine
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Execute demand clubbing, valuation hierarchy, ceiling checks, and PO consolidation
              </CardDescription>
            </div>
            {batchResults.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleExportCSV}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download 13-Column Decision CSV
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* File Upload Area */}
            <div className="md:col-span-6 border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Upload className="w-6 h-6 text-slate-400" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">
                    {batchFile ? batchFile.name : "Select PR Batch CSV"}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {batchFile ? `${(batchFile.size / 1024).toFixed(1)} KB` : "e.g. sample_pr_batch.csv"}
                  </span>
                </div>
              </div>
              <label className="cursor-pointer">
                <span className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50">
                  {batchFile ? 'Change' : 'Browse'}
                </span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setBatchFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>

            {/* Buttons & Quick Actions */}
            <div className="md:col-span-6 flex flex-wrap items-center gap-2">
              <Button
                onClick={handleProcessUploaded}
                disabled={processing || !batchFile}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9 flex-1"
              >
                {processing ? (
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Evaluating...</span>
                  </div>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    Process Uploaded File
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleRunSampleBatch}
                disabled={processing}
                className="text-xs h-9 border-slate-300 bg-white"
              >
                <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Run Standard 186-Line Sample Batch
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Stats when results are loaded */}
      {batchResults.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-slate-200">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Processed PR Lines</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{batchResults.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                <FileText className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Awarded PO Lines</p>
                <p className="text-xl font-bold text-emerald-600 mt-0.5">{poCount}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sourcing Requests</p>
                <p className="text-xl font-bold text-amber-600 mt-0.5">{sourcingCount}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Consolidated POs</p>
                <p className="text-xl font-bold text-purple-600 mt-0.5">{consolidatedPOCount}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
                <Layers className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      {batchResults.length > 0 && (
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by PR, Item, Req Group, PO ID, or Supplier..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="ALL">All Decisions</option>
              <option value="PO">PO Only</option>
              <option value="SOURCING_REQUEST">Sourcing Request Only</option>
            </select>

            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="ALL">All Routes</option>
              <option value="CONTRACT_PO">Contract PO</option>
              <option value="SPOT_PO">Spot PO</option>
              <option value="EMERGENCY_PO">Emergency PO</option>
              <option value="RFQ">RFQ</option>
              <option value="RFP">RFP</option>
              <option value="CAPEX_SOURCING">Capex</option>
              <option value="NEW_ITEM_SOURCING">New Item</option>
            </select>
          </div>
        </div>
      )}

      {/* 13-Column Schema Table */}
      {batchResults.length > 0 && (
        <Card className="border-slate-200 shadow-xs overflow-hidden">
          <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
              <span>Standard 13-Column Evaluation Results ({filtered.length} matching rows)</span>
              <span className="font-mono text-[11px] font-normal text-slate-500">
                Sorted by (created_at, pr_no, pr_line)
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5">PR / Line</th>
                    <th className="p-2.5">Resolved Item</th>
                    <th className="p-2.5">Group ID</th>
                    <th className="p-2.5">Decision</th>
                    <th className="p-2.5">Route</th>
                    <th className="p-2.5">PO ID</th>
                    <th className="p-2.5">Supplier</th>
                    <th className="p-2.5 text-right">Unit Price</th>
                    <th className="p-2.5 text-right">Group Value</th>
                    <th className="p-2.5">Suggested Suppliers</th>
                    <th className="p-2.5">Policy</th>
                    <th className="p-2.5 min-w-[200px]">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r, idx) => {
                    const isPO = r.decision === 'PO';

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors font-mono text-[11px]">
                        <td className="p-2.5 whitespace-nowrap font-bold text-slate-900">
                          {r.pr_no}/{r.pr_line}
                        </td>

                        <td className="p-2.5 whitespace-nowrap">
                          <span className={r.resolved_item_code === 'NEW' ? 'text-amber-600 font-bold' : 'text-slate-800'}>
                            {r.resolved_item_code}
                          </span>
                        </td>

                        <td className="p-2.5 whitespace-nowrap text-slate-600">
                          {r.group_id}
                        </td>

                        <td className="p-2.5 whitespace-nowrap">
                          <Badge
                            variant={isPO ? 'success' : 'warning'}
                            className="text-[10px] py-0 px-1.5"
                          >
                            {r.decision}
                          </Badge>
                        </td>

                        <td className="p-2.5 whitespace-nowrap font-sans">
                          <Badge variant="outline" className="text-[10px] py-0 font-semibold">
                            {r.route}
                          </Badge>
                        </td>

                        <td className="p-2.5 whitespace-nowrap">
                          {r.po_id ? (
                            <span className="font-bold text-blue-600">{r.po_id}</span>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>

                        <td className="p-2.5 whitespace-nowrap font-sans text-slate-800">
                          {r.supplier_id || <span className="text-slate-400 italic">Quotes</span>}
                        </td>

                        <td className="p-2.5 whitespace-nowrap text-right text-slate-700">
                          {r.unit_price ? `₹${Number(r.unit_price).toFixed(2)}` : '-'}
                        </td>

                        <td className="p-2.5 whitespace-nowrap text-right font-bold text-slate-900">
                          ₹{Number(r.group_value_inr || 0).toLocaleString()}
                        </td>

                        <td className="p-2.5 max-w-[150px] truncate text-[10px] text-slate-500">
                          {r.suggested_supplier_ids || '-'}
                        </td>

                        <td className="p-2.5 whitespace-nowrap text-slate-500 text-[10px]">
                          v{r.policy_version}
                        </td>

                        <td className="p-2.5 font-sans text-[11px] text-slate-600">
                          {r.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
