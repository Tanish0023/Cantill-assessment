import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, CheckCircle2, AlertTriangle, 
  Search, Eye, PlusCircle, Building2, Calendar, FileUp, DollarSign
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import * as api from '@/lib/api';

interface ContractsScreenProps {
  showNotification: (msg: string, type?: 'success' | 'error') => void;
}

export const ContractsScreen: React.FC<ContractsScreenProps> = ({ showNotification }) => {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // PDF Upload state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Line items inspection modal
  const [linesModalContract, setLinesModalContract] = useState<any>(null);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const data = await api.fetchContracts();
      setContracts(data || []);
    } catch (err: any) {
      showNotification('Failed to load contracts: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  const handleUploadPDF = async () => {
    if (!pdfFile) {
      showNotification('Please select a PDF contract document.', 'error');
      return;
    }
    setUploading(true);
    try {
      const res = await api.uploadContractPDF(pdfFile, 'Buyer');
      showNotification(`Contract ${res.contract?.contract_id || 'PDF'} parsed and ingested via PyMuPDF!`, 'success');
      setUploadModalOpen(false);
      setPdfFile(null);
      loadContracts();
    } catch (err: any) {
      showNotification('Failed to upload/parse PDF contract: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const filtered = contracts.filter((c) => {
    const term = search.toLowerCase();
    return (
      !search ||
      c.contract_id?.toLowerCase().includes(term) ||
      c.supplier_name?.toLowerCase().includes(term) ||
      c.supplier_id?.toLowerCase().includes(term)
    );
  });

  const totalCap = contracts.reduce((acc, c) => acc + (c.value_cap || 0), 0);
  const totalConsumed = contracts.reduce((acc, c) => acc + (c.consumed_value || 0), 0);
  const totalRemaining = totalCap - totalConsumed;

  return (
    <div className="space-y-5">
      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Contract Ceilings</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">₹{(totalCap / 100000).toFixed(2)} Lakhs</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Consumed Value</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">₹{(totalConsumed / 100000).toFixed(2)} Lakhs</p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Available Headroom</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">₹{(totalRemaining / 100000).toFixed(2)} Lakhs</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by contract ID or supplier name..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setUploadModalOpen(true)}
            className="bg-slate-900 text-white text-xs h-9"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Ingest PDF Contract
          </Button>
          <Button variant="outline" size="sm" onClick={loadContracts} disabled={loading} className="h-9 text-xs">
            Refresh
          </Button>
        </div>
      </div>

      {/* Contracts Table */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-medium">Loading rate contracts and ceiling tracking...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <FileText className="w-9 h-9 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">No contracts found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">Contract ID</th>
                    <th className="p-3">Supplier Name & ID</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Validity Period</th>
                    <th className="p-3">Value Ceiling</th>
                    <th className="p-3">Consumed Value</th>
                    <th className="p-3">Remaining Ceiling</th>
                    <th className="p-3 w-40">Ceiling Utilization</th>
                    <th className="p-3 text-right">Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((c) => {
                    const cap = c.value_cap || 1;
                    const consumed = c.consumed_value || 0;
                    const remaining = c.remaining_ceiling !== undefined ? c.remaining_ceiling : cap - consumed;
                    const pct = Math.min(Math.round((consumed / cap) * 100), 100);
                    const isExhausted = remaining <= 0;
                    const isNearCeiling = pct >= 85;

                    return (
                      <tr key={c.contract_id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 block">{c.contract_id}</span>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-900 block">{c.supplier_name || 'N/A'}</span>
                          <span className="text-[11px] font-mono text-slate-500">{c.supplier_id}</span>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <Badge
                            variant={c.source_type === 'PDF' ? 'purple' : 'secondary'}
                            className="text-[10px] font-semibold"
                          >
                            {c.source_type || 'REGISTER'}
                          </Badge>
                        </td>

                        <td className="p-3 whitespace-nowrap text-slate-600 text-[11px]">
                          {c.start_date} <span className="text-slate-400">to</span> {c.end_date}
                        </td>

                        <td className="p-3 whitespace-nowrap font-bold text-slate-900 font-mono">
                          ₹{c.value_cap?.toLocaleString()}
                        </td>

                        <td className="p-3 whitespace-nowrap font-mono text-slate-700">
                          ₹{consumed.toLocaleString()}
                        </td>

                        <td className="p-3 whitespace-nowrap font-mono font-bold">
                          <span className={isExhausted ? 'text-red-600' : isNearCeiling ? 'text-amber-600' : 'text-emerald-600'}>
                            ₹{remaining.toLocaleString()}
                          </span>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="font-mono font-bold text-slate-800">{pct}%</span>
                            {isExhausted && <Badge variant="destructive" className="text-[9px] py-0 px-1">Exhausted</Badge>}
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </td>

                        <td className="p-3 whitespace-nowrap text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLinesModalContract(c)}
                            className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            {c.lines?.length || 0} Lines
                          </Button>
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

      {/* Contract Line Items Modal */}
      <Dialog open={!!linesModalContract} onOpenChange={(open) => !open && setLinesModalContract(null)}>
        <DialogContent className="max-w-xl" onClose={() => setLinesModalContract(null)}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Contract Lines: {linesModalContract?.contract_id}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Supplier: <span className="font-semibold text-slate-800">{linesModalContract?.supplier_name}</span> ({linesModalContract?.supplier_id})
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-2.5">Item Code</th>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5">UOM</th>
                  <th className="p-2.5 text-right">Contracted Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linesModalContract?.lines?.map((l: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-slate-800">{l.item_code}</td>
                    <td className="p-2.5 text-slate-700">{l.description}</td>
                    <td className="p-2.5 text-slate-500">{l.uom}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-700">₹{l.rate?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLinesModalContract(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ingest PDF Contract Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-md" onClose={() => setUploadModalOpen(false)}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center">
              <FileUp className="w-4 h-4 text-purple-600 mr-2" />
              Ingest Signed PDF Rate Contract
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Upload a rate contract PDF. The backend extracts terms, rates, and ceiling limits via PyMuPDF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <FileUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              {pdfFile ? (
                <div>
                  <span className="font-semibold text-xs text-slate-900 block">{pdfFile.name}</span>
                  <span className="text-[10px] text-slate-500">{(pdfFile.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-600 font-medium">Select a signed contract PDF</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">e.g. RC-2026-031.pdf, RC-2026-033.pdf</p>
                </div>
              )}
              <label className="cursor-pointer mt-3 inline-block">
                <span className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50">
                  {pdfFile ? 'Change File' : 'Browse File'}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setPdfFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <DialogFooter className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={() => setUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleUploadPDF}
              disabled={uploading || !pdfFile}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {uploading ? 'Extracting via PyMuPDF...' : 'Ingest Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
