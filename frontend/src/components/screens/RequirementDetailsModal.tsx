import React from 'react';
import { 
  Building2, Calendar, CheckCircle2, Clock, 
  ExternalLink, FileText, Layers, ShieldCheck, 
  Tag, AlertTriangle, UserCheck, X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface RequirementDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: any;
  onApprove?: (groupId: string) => void;
  onOpenOverride?: (groupId: string, currentRoute: string) => void;
}

export const RequirementDetailsModal: React.FC<RequirementDetailsModalProps> = ({
  open,
  onOpenChange,
  details,
  onApprove,
  onOpenOverride,
}) => {
  if (!details) return null;

  const req = details.requirement || details;
  const dec = details.decision || {};
  const audits = details.audit_trail || [];
  const lines = req.lines || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="font-mono text-sm px-2.5 py-0.5 font-bold">
                {req.group_id}
              </Badge>
              {req.is_emergency && (
                <Badge variant="destructive" className="flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  EMERGENCY
                </Badge>
              )}
            </div>
            <Badge 
              variant={dec.status === 'APPROVED' ? 'success' : dec.status === 'OVERRIDDEN' ? 'warning' : 'secondary'}
              className="text-xs font-semibold px-2.5"
            >
              {dec.status || 'AUTO_GENERATED'}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 mt-2">
            {req.item_description || req.item_code}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Plant: <span className="font-semibold text-slate-800">{req.plant}</span> | Total Quantity:{' '}
            <span className="font-semibold text-slate-800">
              {req.total_quantity?.toLocaleString()} {req.uom || 'NOS'}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Decision Route
              </span>
              <span className="font-bold text-sm text-slate-900 block mt-0.5">
                {dec.route || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Requirement Value
              </span>
              <span className="font-bold text-sm text-slate-900 block mt-0.5">
                ₹{Number(req.group_value_inr || dec.group_value_inr || 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Unit Rate / Price
              </span>
              <span className="font-bold text-sm text-slate-900 block mt-0.5">
                {req.unit_price ? `₹${Number(req.unit_price).toLocaleString()}` : 'TBD (Quotes)'}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Assigned PO
              </span>
              <span className="font-mono font-bold text-sm text-blue-600 block mt-0.5">
                {dec.po_id || 'N/A (Sourcing)'}
              </span>
            </div>
          </div>

          {/* Decision Reason & Policy Clause */}
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Policy Evaluation & Clause</span>
                {dec.applied_clause && (
                  <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">
                    Clause {dec.applied_clause}
                  </Badge>
                )}
                {dec.policy_version && (
                  <Badge variant="secondary" className="text-[11px]">
                    Policy v{dec.policy_version}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                {dec.reason || 'Decision reached according to Corvo Procurement Policy rules.'}
              </p>

              {dec.override_reason && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <span className="font-bold flex items-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    Buyer Override Notice:
                  </span>
                  <p className="mt-1">{dec.override_reason}</p>
                  {dec.acted_by && (
                    <p className="text-[10px] text-amber-700 mt-1">
                      Action taken by: <span className="font-semibold">{dec.acted_by}</span> on {dec.acted_at}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Suggested / Awarded Suppliers */}
          <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span className="flex items-center">
                <Tag className="w-4 h-4 text-purple-600 mr-1.5" />
                Awarded / Suggested Suppliers
              </span>
            </div>
            {dec.supplier_id ? (
              <div className="flex items-center justify-between bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase block">Selected Supplier</span>
                  <span className="font-bold text-sm text-slate-900">
                    {dec.supplier_name ? `${dec.supplier_name} (${dec.supplier_id})` : dec.supplier_id}
                  </span>
                </div>
                <Badge variant="success">Primary Award</Badge>
              </div>
            ) : dec.suggested_supplier_ids ? (
              <div className="space-y-1.5">
                <span className="text-xs text-slate-500">RFQ/RFP Candidates from Preferred Supplier Ranking:</span>
                <div className="flex flex-wrap gap-2">
                  {dec.suggested_supplier_ids.split(';').map((sId: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="px-2.5 py-1 text-xs font-mono font-medium bg-slate-50">
                      #{idx + 1} {sId}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No supplier suggestions (e.g. New Item sourcing).</p>
            )}
          </div>

          {/* Clubbed PR Lines */}
          {lines.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 flex items-center">
                  <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Clubbed Demand Lines ({lines.length})
                </span>
                <span className="text-[11px] text-slate-500">14-day creation & ±7-day need-by window</span>
              </div>
              <div className="max-h-36 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 text-left">
                    <tr>
                      <th className="p-2">PR / Line</th>
                      <th className="p-2">Requester / Dept</th>
                      <th className="p-2">Quantity</th>
                      <th className="p-2">Need By</th>
                      <th className="p-2">Urgency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-semibold">{l.pr_no}/{l.pr_line}</td>
                        <td className="p-2 text-slate-600">{l.requester || 'Engineering'} ({l.department || 'Stores'})</td>
                        <td className="p-2 font-medium">{l.quantity} {l.uom || req.uom}</td>
                        <td className="p-2 text-slate-600">{l.need_by_date}</td>
                        <td className="p-2">
                          <Badge variant={l.urgency === 'Emergency' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {l.urgency || 'Normal'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Chronological Audit Trail */}
          {audits.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Audit Trail ({audits.length} Events)
              </span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {audits.map((a: any, idx: number) => (
                  <div key={idx} className="bg-white p-2 rounded border border-slate-200 text-xs flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-800">{a.action}</span>
                      <span className="text-slate-500 text-[11px] ml-2">by {a.performed_by}</span>
                      <p className="text-slate-600 text-[11px] mt-0.5">{a.comment}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap ml-2">
                      {a.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex items-center space-x-2">
            {onOpenOverride && dec.status !== 'APPROVED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onOpenOverride(req.group_id, dec.route);
                }}
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                Override Decision
              </Button>
            )}
            {onApprove && dec.status !== 'APPROVED' && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onApprove(req.group_id);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Approve Decision
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
