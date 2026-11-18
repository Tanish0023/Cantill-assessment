import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Upload, FileText, CheckCircle2, XCircle, 
  Clock, AlertTriangle, ArrowRight, Sparkles, RefreshCw, FileUp
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import * as api from '@/lib/api';

interface PolicyScreenProps {
  showNotification: (msg: string, type?: 'success' | 'error') => void;
}

export const PolicyScreen: React.FC<PolicyScreenProps> = ({ showNotification }) => {
  const [policies, setPolicies] = useState<any[]>([]);
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Amendment draft & preview state
  const [amendmentText, setAmendmentText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [amendmentPreview, setAmendmentPreview] = useState<any>(null);
  const [draftSubmitting, setDraftSubmitting] = useState(false);

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const sampleAmendments = [
    "Per Board Resolution BR-2026-11, raise spot purchase threshold from 2,00,000 INR to 3,00,000 INR effective immediately.",
    "Extend the maximum clubbing window from 14 days to 21 days for all manufacturing plants.",
    "Increase Emergency PO upper limit to 7,50,000 INR for critical breakdown items."
  ];

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const [list, active] = await Promise.all([
        api.fetchPolicies(),
        api.fetchActivePolicy().catch(() => null)
      ]);
      setPolicies(list || []);
      setActivePolicy(active || (list && list.length ? list[0] : null));
    } catch (err: any) {
      showNotification('Failed to load policies: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const handlePreview = async () => {
    if (!amendmentText.trim() && !pdfFile) {
      showNotification('Please enter amendment text or upload a PDF document.', 'error');
      return;
    }
    setPreviewLoading(true);
    setAmendmentPreview(null);
    try {
      let preview;
      if (pdfFile) {
        preview = await api.previewPolicyAmendmentPDF(pdfFile);
      } else {
        preview = await api.previewPolicyAmendment(amendmentText.trim());
      }
      setAmendmentPreview(preview);
      showNotification('Amendment preview and diff generated successfully!', 'success');
    } catch (err: any) {
      showNotification('Failed to preview amendment: ' + err.message, 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!amendmentPreview) return;
    setDraftSubmitting(true);
    try {
      const res = await api.createPolicyDraft(
        amendmentPreview,
        amendmentText || pdfFile?.name || 'Amendment Document',
        'Procurement Head'
      );
      showNotification(`Policy draft v${res.version || '5.1'} created in PENDING_APPROVAL status!`, 'success');
      setAmendmentPreview(null);
      setAmendmentText('');
      setPdfFile(null);
      loadPolicies();
    } catch (err: any) {
      showNotification('Failed to create draft policy: ' + err.message, 'error');
    } finally {
      setDraftSubmitting(false);
    }
  };

  const handleApprovePolicy = async (id: number) => {
    try {
      const res = await api.approvePolicyVersion(id, 'Head of Procurement');
      showNotification(`Policy version v${res.version || ''} approved and activated!`, 'success');
      loadPolicies();
    } catch (err: any) {
      showNotification('Failed to approve policy: ' + err.message, 'error');
    }
  };

  const handleRejectPolicy = async (id: number) => {
    try {
      await api.rejectPolicyVersion(id, 'Rejected by management review', 'Head of Procurement');
      showNotification('Policy draft rejected.', 'success');
      loadPolicies();
    } catch (err: any) {
      showNotification('Failed to reject policy: ' + err.message, 'error');
    }
  };

  const rules = activePolicy?.rules_config || {};

  return (
    <div className="space-y-6">
      {/* Active Policy Header Card */}
      <Card className="border-slate-200 bg-linear-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <h2 className="text-xl font-bold tracking-tight">
                  {activePolicy?.title || 'Corvo Engineering Procurement Policy'}
                </h2>
                <Badge variant="success" className="font-bold text-xs">
                  ACTIVE v{activePolicy?.version || '5.0'}
                </Badge>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Document Ref: <span className="font-mono font-semibold">{activePolicy?.document_id || 'CORVO-PROC-POL-04'}</span> | Effective Date: <span className="font-semibold">{activePolicy?.effective_date || '2026-04-01'}</span>
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-xs border border-white/10 font-mono">
                "Policy as Data" Active
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout: Rules Viewer & Amendment Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Rules Config */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center">
                <FileText className="w-4 h-4 text-blue-600 mr-2" />
                Active Thresholds & Rule Invariants
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Live parameters governing the autonomous decision engine
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Rule 5.4: Spot Purchase Threshold</span>
                  <span className="text-[11px] text-slate-500">Requires PO history in last 365d</span>
                </div>
                <span className="font-bold text-sm text-slate-900">
                  ₹{Number(rules.rule_5_3_max_value || 200000).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Rule 5.3: Emergency PO Threshold</span>
                  <span className="text-[11px] text-slate-500">Upper cap for emergency direct awards</span>
                </div>
                <span className="font-bold text-sm text-slate-900">
                  ₹{Number(rules.emergency_limit || 500000).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Rule 5.5: RFQ Quotes Range</span>
                  <span className="text-[11px] text-slate-500">Spot limit up to RFP formal limit</span>
                </div>
                <span className="font-bold text-sm text-slate-900">
                  2L – 10 Lakhs
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Section 2: Demand Clubbing Interval</span>
                  <span className="text-[11px] text-slate-500">Same item & plant cluster window</span>
                </div>
                <span className="font-bold text-sm text-slate-900">
                  {rules.clubbing_window_days || 14} Days
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Section 2: Need-By Tolerance</span>
                  <span className="text-[11px] text-slate-500">Cluster window around first need-by</span>
                </div>
                <span className="font-bold text-sm text-slate-900">
                  ± {rules.need_by_window_days || 7} Days
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Section 6: Preferred Supplier Weights</span>
                  <span className="text-[11px] text-slate-500">Freq (30%), Rec (25%), Con (20%), OTD (15%), Qual (10%)</span>
                </div>
                <Badge variant="outline" className="font-mono text-xs">Composite</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Version History */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center">
                <Clock className="w-4 h-4 text-purple-600 mr-2" />
                Policy Version History & Approvals
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2.5 text-xs">
              {policies.map((p) => {
                const isPending = p.status === 'PENDING_APPROVAL';
                const isActive = p.status === 'ACTIVE';

                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : isPending
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold font-mono text-sm text-slate-900">
                          v{p.version}
                        </span>
                        <Badge
                          variant={isActive ? 'success' : isPending ? 'warning' : 'secondary'}
                          className="text-[10px]"
                        >
                          {p.status}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-slate-500">{p.effective_date}</span>
                    </div>

                    <p className="text-slate-600 text-xs mt-1.5 font-medium">{p.title}</p>
                    {p.change_summary && (
                      <p className="text-slate-500 text-[11px] mt-0.5">{p.change_summary}</p>
                    )}

                    {isPending && (
                      <div className="flex items-center space-x-2 mt-3 pt-2 border-t border-amber-200/60 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRejectPolicy(p.id)}
                          className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprovePolicy(p.id)}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Approve & Activate
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: AI Amendment Console & Diff Preview */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center">
                <Sparkles className="w-4 h-4 text-amber-500 mr-2" />
                AI Amendment Console & Impact Diff
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Propose policy amendments via plain text or upload an amendment memo PDF
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Amendment Memo Text
                </label>
                <Textarea
                  value={amendmentText}
                  onChange={(e) => setAmendmentText(e.target.value)}
                  placeholder="Paste management circular or amendment instruction here..."
                  className="text-xs min-h-[110px]"
                  disabled={previewLoading}
                />
              </div>

              {/* Sample Prompts */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">Quick Sample:</span>
                {sampleAmendments.map((sa, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setAmendmentText(sa);
                      setPdfFile(null);
                    }}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded transition-colors"
                  >
                    {idx === 0 ? "Spot PO 2L → 3L" : idx === 1 ? "Clubbing 14d → 21d" : "Emergency Cap 7.5L"}
                  </button>
                ))}
              </div>

              {/* PDF Upload Option */}
              <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileUp className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="text-xs font-medium text-slate-700 block">
                      {pdfFile ? pdfFile.name : "Or upload an amendment PDF document"}
                    </span>
                    <span className="text-[10px] text-slate-400">PDFs parsed via PyMuPDF</span>
                  </div>
                </div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md shadow-xs hover:bg-slate-50 text-slate-700">
                    Browse PDF
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

              <Button
                onClick={handlePreview}
                disabled={previewLoading || (!amendmentText.trim() && !pdfFile)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs h-9"
              >
                {previewLoading ? (
                  <div className="flex items-center space-x-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Policy Impact via Gemini...</span>
                  </div>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1.5 text-amber-400" />
                    Generate AI Diff & Impact Preview
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* AI Diff Preview Card */}
          {amendmentPreview && (
            <Card className="border-amber-200 bg-amber-50/30 shadow-xs animate-in zoom-in-95 duration-150">
              <CardHeader className="pb-3 border-b border-amber-200/60">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-amber-950 flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 mr-2" />
                    Proposed Policy Draft: v{amendmentPreview.new_version || '5.1'}
                  </CardTitle>
                  <Badge variant="warning">Draft Preview</Badge>
                </div>
                <CardDescription className="text-xs text-amber-800">
                  Effective Date: <span className="font-semibold">{amendmentPreview.effective_date || 'Immediate'}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4 space-y-3 text-xs">
                {/* Plain-Language Explanation */}
                <div className="p-3 bg-white rounded-lg border border-amber-200">
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                    Plain-Language Impact Summary
                  </span>
                  <p className="text-slate-800 leading-relaxed">
                    {amendmentPreview.plain_language_preview || amendmentPreview.change_summary}
                  </p>
                </div>

                {/* Structured Parameter Changes Diff */}
                <div className="bg-white p-3 rounded-lg border border-amber-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                    Machine-Readable Parameter Diffs
                  </span>
                  {amendmentPreview.diffs && amendmentPreview.diffs.length > 0 ? (
                    <div className="space-y-1.5">
                      {amendmentPreview.diffs.map((d: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 font-mono text-[11px]">
                          <span className="text-slate-600">{d.parameter}:</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-red-600 line-through">{String(d.old_value)}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-emerald-600 font-bold">{String(d.new_value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic text-xs">
                      Updates to rules config generated for runtime execution.
                    </p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-3 border-t border-amber-200/60 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setAmendmentPreview(null)}>
                  Discard Preview
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCreateDraft}
                  disabled={draftSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {draftSubmitting ? 'Submitting Draft...' : 'Submit Draft for Approval'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
