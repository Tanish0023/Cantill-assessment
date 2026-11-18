import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Layers, Search, Filter, CheckCircle2, AlertTriangle, 
  ExternalLink, Eye, ArrowUpDown, Clock, Building2, UserCheck, ShieldAlert, Loader2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RequirementDetailsModal } from './RequirementDetailsModal';
import * as api from '@/lib/api';

interface BuyerScreenProps {
  showNotification: (msg: string, type?: 'success' | 'error') => void;
}

export const BuyerScreen: React.FC<BuyerScreenProps> = ({ showNotification }) => {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [stats, setStats] = useState<api.WorkspaceStats>({
    total: 0,
    pending: 0,
    approved: 0,
    overridden: 0,
    emergency: 0
  });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [search, setSearch] = useState('');
  const [plantFilter, setPlantFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [routeFilter, setRouteFilter] = useState('ALL');

  const observerTarget = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modals state
  const [selectedReqDetails, setSelectedReqDetails] = useState<any>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideGroupId, setOverrideGroupId] = useState('');
  const [overrideRoute, setOverrideRoute] = useState('RFQ');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const loadInitialRequirements = useCallback(async (
    currentSearch = search,
    currentPlant = plantFilter,
    currentStatus = statusFilter,
    currentRoute = routeFilter
  ) => {
    setLoading(true);
    try {
      const res = await api.fetchWorkspaceRequirements({
        limit: 20,
        offset: 0,
        search: currentSearch,
        plant: currentPlant,
        status: currentStatus,
        route: currentRoute
      });
      setRequirements(res.items);
      const effTotal = res.totalCount || res.stats?.total || res.items.length;
      setTotalCount(effTotal);
      setHasMore(res.hasMore || (res.items.length < effTotal));
      if (res.stats) {
        setStats(res.stats);
      } else {
        api.fetchBuyerStats().then(s => s && setStats(s)).catch(() => {});
      }
    } catch (err: any) {
      showNotification('Failed to load workspace requirements: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, plantFilter, statusFilter, routeFilter, showNotification]);

  const loadMoreRequirements = async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const currentOffset = requirements.length;
      const res = await api.fetchWorkspaceRequirements({
        limit: 20,
        offset: currentOffset,
        search,
        plant: plantFilter,
        status: statusFilter,
        route: routeFilter
      });
      if (!res.items || res.items.length === 0) {
        setHasMore(false);
      } else {
        setRequirements(prev => {
          const seen = new Set(prev.map(i => i.group_id));
          const uniqueNew = res.items.filter(i => !seen.has(i.group_id));
          return [...prev, ...uniqueNew];
        });
        const effTotal = res.totalCount || res.stats?.total || totalCount;
        setTotalCount(effTotal);
        const newTotalCount = currentOffset + res.items.length;
        setHasMore(res.hasMore && (newTotalCount < effTotal));
      }
    } catch (err: any) {
      showNotification('Failed to load more requirements: ' + err.message, 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  // Initial load and filter change trigger
  useEffect(() => {
    loadInitialRequirements(search, plantFilter, statusFilter, routeFilter);
  }, [plantFilter, statusFilter, routeFilter]);

  // Debounced search trigger
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadInitialRequirements(val, plantFilter, statusFilter, routeFilter);
    }, 350);
  };

  // Dual infinite scroll: IntersectionObserver with rootMargin + scroll listener fallback
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMoreRequirements();
        }
      },
      { root: null, rootMargin: '250px', threshold: 0.01 }
    );

    observer.observe(target);
    return () => {
      observer.unobserve(target);
    };
  }, [hasMore, loading, loadingMore, requirements.length, search, plantFilter, statusFilter, routeFilter]);

  useEffect(() => {
    const handleScroll = () => {
      if (!hasMore || loading || loadingMore) return;
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const clientHeight = document.documentElement.clientHeight;
      if (scrollTop + clientHeight >= scrollHeight - 350) {
        loadMoreRequirements();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, loading, loadingMore, requirements.length, search, plantFilter, statusFilter, routeFilter]);

  const handleOpenDetails = async (groupId: string) => {
    setDetailsLoading(true);
    try {
      const details = await api.fetchRequirementDetails(groupId);
      setSelectedReqDetails(details);
      setDetailsModalOpen(true);
    } catch (err: any) {
      showNotification('Failed to load requirement details: ' + err.message, 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleApprove = async (groupId: string) => {
    try {
      await api.approveDecision(groupId, 'Buyer Workspace');
      showNotification(`Requirement ${groupId} decision approved!`, 'success');
      // In-place update so user doesn't lose infinite scroll position
      setRequirements(prev => prev.map(r => {
        if (r.group_id === groupId) {
          return {
            ...r,
            status: 'APPROVED',
            decision: r.decision ? { ...r.decision, status: 'APPROVED' } : { status: 'APPROVED' }
          };
        }
        return r;
      }));
      setStats(prev => ({
        ...prev,
        approved: prev.approved + 1,
        pending: Math.max(0, prev.pending - 1)
      }));
    } catch (err: any) {
      showNotification('Failed to approve decision: ' + err.message, 'error');
    }
  };

  const handleOpenOverride = (groupId: string, currentRoute: string) => {
    setOverrideGroupId(groupId);
    setOverrideRoute(currentRoute || 'RFQ');
    setOverrideReason('');
    setOverrideModalOpen(true);
  };

  const handleSubmitOverride = async () => {
    if (!overrideReason.trim()) {
      showNotification('Mandatory written reason required for decision override.', 'error');
      return;
    }
    setOverrideSubmitting(true);
    try {
      await api.overrideDecision(overrideGroupId, overrideRoute, overrideReason.trim(), 'Senior Buyer');
      showNotification(`Decision for ${overrideGroupId} successfully overridden to ${overrideRoute}!`, 'success');
      setOverrideModalOpen(false);
      // In-place update
      setRequirements(prev => prev.map(r => {
        if (r.group_id === overrideGroupId) {
          return {
            ...r,
            status: 'OVERRIDDEN',
            decision: {
              ...(r.decision || {}),
              status: 'OVERRIDDEN',
              route: overrideRoute,
              override_reason: overrideReason.trim()
            }
          };
        }
        return r;
      }));
      setStats(prev => ({
        ...prev,
        overridden: prev.overridden + 1,
        pending: Math.max(0, prev.pending - 1)
      }));
    } catch (err: any) {
      showNotification('Failed to override decision: ' + err.message, 'error');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  // Filter logic (also supports client-side instantaneous filtering)
  const filtered = requirements.filter((r) => {
    const term = search.toLowerCase();
    const d = r.decision || {};
    const matchesSearch = 
      !search ||
      r.group_id?.toLowerCase().includes(term) ||
      r.resolved_item_code?.toLowerCase().includes(term) ||
      r.item_code?.toLowerCase().includes(term) ||
      r.item_description?.toLowerCase().includes(term) ||
      d.po_id?.toLowerCase().includes(term);

    const matchesPlant = plantFilter === 'ALL' || r.plant === plantFilter;
    const matchesStatus = statusFilter === 'ALL' || (d.status || r.status) === statusFilter;
    const matchesRoute = routeFilter === 'ALL' || d.route === routeFilter;

    return matchesSearch && matchesPlant && matchesStatus && matchesRoute;
  });

  return (
    <div className="space-y-5">
      {/* KPI Header Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Evaluated</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{stats.total || totalCount || requirements.length}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Action</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">{stats.pending || 0}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Buyer Approved</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.approved || 0}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Overridden</p>
              <p className="text-xl font-bold text-purple-600 mt-0.5">{stats.overridden || 0}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by Requirement ID, Item, Description, or PO..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Plant Selector */}
          <select
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
            className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">All Plants</option>
            <option value="PUN1">PUN1 (Bhosari)</option>
            <option value="CHK1">CHK1 (Chakan)</option>
          </select>

          {/* Status Selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">All Statuses</option>
            <option value="AUTO_GENERATED">Pending Action</option>
            <option value="APPROVED">Approved</option>
            <option value="OVERRIDDEN">Overridden</option>
          </select>

          {/* Route Selector */}
          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">All Routes</option>
            <option value="CONTRACT_PO">Contract PO</option>
            <option value="SPOT_PO">Spot PO</option>
            <option value="EMERGENCY_PO">Emergency PO</option>
            <option value="RFQ">RFQ (Quotes)</option>
            <option value="RFP">RFP (Formal)</option>
            <option value="CAPEX_SOURCING">Capex</option>
            <option value="NEW_ITEM_SOURCING">New Item</option>
          </select>

          <Button variant="outline" size="sm" onClick={() => loadInitialRequirements(search, plantFilter, statusFilter, routeFilter)} disabled={loading} className="h-9 text-xs">
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium">Loading requirements from database...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Layers className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No requirements match your filter.</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search criteria or process a batch of PRs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Req ID / Plant</th>
                  <th className="p-3">Item & Description</th>
                  <th className="p-3">Total Demand</th>
                  <th className="p-3">Unit Price</th>
                  <th className="p-3">Requirement Value</th>
                  <th className="p-3">Decision Route</th>
                  <th className="p-3">Assigned PO / Supplier</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const d = r.decision || {};
                  const isApproved = d.status === 'APPROVED';
                  const isOverridden = d.status === 'OVERRIDDEN';

                  return (
                    <tr key={r.group_id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-bold text-slate-900">{r.group_id}</span>
                          {r.is_emergency && (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1">
                              EMG
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] mt-1 font-semibold">
                          {r.plant}
                        </Badge>
                      </td>

                      <td className="p-3 max-w-xs">
                        <span className="font-semibold text-slate-900 line-clamp-1">
                          {r.item_description || r.resolved_item_code || r.item_code}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 block">
                          {r.resolved_item_code || r.item_code || 'NEW'}
                        </span>
                      </td>

                      <td className="p-3 whitespace-nowrap font-medium text-slate-800">
                        {r.total_quantity?.toLocaleString()} {r.uom || 'NOS'}
                      </td>

                      <td className="p-3 whitespace-nowrap text-slate-700">
                        {r.unit_price ? `₹${Number(r.unit_price).toLocaleString()}` : <span className="text-slate-400 italic">Quotes</span>}
                      </td>

                      <td className="p-3 whitespace-nowrap font-bold text-slate-900">
                        ₹{Number(r.group_value_inr || d.group_value_inr || 0).toLocaleString()}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <Badge 
                          variant={
                            d.route === 'CONTRACT_PO' ? 'success' :
                            d.route === 'SPOT_PO' ? 'default' :
                            d.route === 'EMERGENCY_PO' ? 'destructive' :
                            d.route === 'RFQ' ? 'warning' :
                            d.route === 'RFP' ? 'purple' : 'info'
                          }
                          className="font-semibold text-[11px]"
                        >
                          {d.route || 'PENDING'}
                        </Badge>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        {d.po_id ? (
                          <div className="font-mono text-blue-600 font-bold">{d.po_id}</div>
                        ) : (
                          <span className="text-slate-400 italic">Sourcing</span>
                        )}
                        <span className="text-[11px] text-slate-500 block truncate max-w-[140px]">
                          {d.supplier_id ? (d.supplier_name || d.supplier_id) : 'Sourcing Request'}
                        </span>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <Badge 
                          variant={isApproved ? 'success' : isOverridden ? 'warning' : 'secondary'}
                          className="text-[10px] font-semibold"
                        >
                          {d.status || r.status || 'AUTO_GENERATED'}
                        </Badge>
                      </td>

                      <td className="p-3 text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDetails(r.group_id)}
                          className="h-8 px-2 text-slate-600 hover:text-slate-900"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Details
                        </Button>

                        {!isApproved && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(r.group_id)}
                              className="h-8 px-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              title="Approve Decision"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              Approve
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenOverride(r.group_id, d.route)}
                              className="h-8 px-2 text-amber-700 border-amber-300 hover:bg-amber-50"
                              title="Override Decision"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                              Override
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Infinite Scroll Sentinel and Status Bar */}
        {!loading && requirements.length > 0 && (
          <>
            {/* Dedicated scroll observer sentinel element right below table */}
            <div ref={observerTarget} className="h-4 w-full pointer-events-none" />

            <div 
              className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50"
            >
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-700">
                  Showing {requirements.length} of {stats.total || totalCount} requirements
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">20 per batch</span>
              </div>

              {loadingMore ? (
                <div className="flex items-center space-x-2 text-blue-600 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading next 20 requirements...</span>
                </div>
              ) : hasMore ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={loadMoreRequirements}
                  className="h-8 text-xs px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-xs"
                >
                  Load Next 20 Requirements ({Math.max(0, (stats.total || totalCount) - requirements.length)} remaining)
                </Button>
              ) : (
                <div className="flex items-center space-x-1.5 text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All {stats.total || totalCount} requirements loaded</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Requirement Details Modal */}
      <RequirementDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        details={selectedReqDetails}
        onApprove={handleApprove}
        onOpenOverride={handleOpenOverride}
      />

      {/* Buyer Override Modal */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="max-w-md" onClose={() => setOverrideModalOpen(false)}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center">
              <AlertTriangle className="w-4 h-4 text-amber-600 mr-2" />
              Override Procurement Decision
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Overriding for requirement: <span className="font-mono font-semibold text-slate-800">{overrideGroupId}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                New Target Route
              </label>
              <select
                value={overrideRoute}
                onChange={(e) => setOverrideRoute(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="CONTRACT_PO">Contract PO (Direct to Contract)</option>
                <option value="SPOT_PO">Spot PO (Under 2L Threshold)</option>
                <option value="EMERGENCY_PO">Emergency PO (Critical Production Exception)</option>
                <option value="RFQ">RFQ (Request for Quotation)</option>
                <option value="RFP">RFP (Formal Sourcing)</option>
                <option value="DIRECT_PURCHASE">Direct Purchase (Management Special Approval)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Mandatory Written Justification *
              </label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="State technical justification, production downtime risk, or management approval reason..."
                className="text-xs min-h-[90px]"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                This justification will be permanently immutably logged into the audit trail.
              </span>
            </div>
          </div>

          <DialogFooter className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={() => setOverrideModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSubmitOverride}
              disabled={overrideSubmitting || !overrideReason.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {overrideSubmitting ? 'Recording...' : 'Confirm Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
