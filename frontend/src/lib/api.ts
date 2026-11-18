let rawBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
if (rawBase && !rawBase.startsWith('http://') && !rawBase.startsWith('https://')) {
  rawBase = `https://${rawBase}`;
}
const API_BASE = rawBase.replace(/\/+$/, '');

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/api/data/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchItems() {
  const res = await fetch(`${API_BASE}/api/data/items`);
  if (!res.ok) throw new Error('Failed to fetch items');
  return res.json();
}

export async function fetchSuppliers() {
  const res = await fetch(`${API_BASE}/api/data/suppliers`);
  if (!res.ok) throw new Error('Failed to fetch suppliers');
  return res.json();
}

export async function fetchPlants() {
  const res = await fetch(`${API_BASE}/api/data/plants`);
  if (!res.ok) throw new Error('Failed to fetch plants');
  return res.json();
}

export async function reimportMasterData() {
  const res = await fetch(`${API_BASE}/api/data/reimport`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reimport master data');
  return res.json();
}

export async function sendChatMessage(message: string, currentState: any = null) {
  const res = await fetch(`${API_BASE}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, current_state: currentState })
  });
  if (!res.ok) throw new Error('Failed to send chat message');
  return res.json();
}

export async function confirmChatPR(data: any) {
  const res = await fetch(`${API_BASE}/api/chat/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to confirm PR');
  return res.json();
}

export async function fetchRecentChatPRs() {
  const res = await fetch(`${API_BASE}/api/chat/recent`);
  if (!res.ok) throw new Error('Failed to fetch recent PRs');
  return res.json();
}

export interface FetchRequirementsParams {
  limit?: number;
  offset?: number;
  plant?: string;
  status?: string;
  route?: string;
  search?: string;
}

export interface WorkspaceStats {
  total: number;
  pending: number;
  approved: number;
  overridden: number;
  emergency: number;
}

export interface WorkspaceRequirementsResponse {
  items: any[];
  totalCount: number;
  hasMore: boolean;
  stats?: WorkspaceStats;
}

export async function fetchWorkspaceRequirements(
  params?: FetchRequirementsParams
): Promise<WorkspaceRequirementsResponse> {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  if (params?.plant && params.plant !== 'ALL') query.set('plant', params.plant);
  if (params?.status && params.status !== 'ALL') query.set('status', params.status);
  if (params?.route && params.route !== 'ALL') query.set('route', params.route);
  if (params?.search && params.search.trim()) query.set('search', params.search.trim());
  query.set('envelope', 'true');

  const queryString = query.toString();
  const url = `${API_BASE}/api/buyer/requirements${queryString ? `?${queryString}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch workspace requirements');

  const data = await res.json();
  if (data && typeof data === 'object' && !Array.isArray(data) && 'items' in data) {
    return {
      items: data.items || [],
      totalCount: Number(data.total_count ?? 0),
      hasMore: Boolean(data.has_more),
      stats: data.stats
    };
  }

  // Fallback for raw array response
  const totalHeader = res.headers.get('X-Total-Count');
  const hasMoreHeader = res.headers.get('X-Has-More');
  const items = Array.isArray(data) ? data : [];
  const totalCount = totalHeader ? parseInt(totalHeader, 10) : items.length;
  const hasMore = hasMoreHeader !== null ? (hasMoreHeader.toLowerCase() === 'true') : (items.length === (params?.limit ?? 20));

  return {
    items,
    totalCount,
    hasMore
  };
}

export async function fetchBuyerStats(): Promise<WorkspaceStats> {
  const res = await fetch(`${API_BASE}/api/buyer/stats`);
  if (!res.ok) throw new Error('Failed to fetch buyer stats');
  return res.json();
}

export async function fetchRequirementDetails(groupId: string) {
  const res = await fetch(`${API_BASE}/api/buyer/requirements/${groupId}`);
  if (!res.ok) throw new Error('Failed to fetch requirement details');
  return res.json();
}

export async function approveDecision(groupId: string, buyerName: string = 'Buyer') {
  const res = await fetch(`${API_BASE}/api/buyer/requirements/${groupId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buyer_name: buyerName })
  });
  if (!res.ok) throw new Error('Failed to approve decision');
  return res.json();
}

export async function overrideDecision(groupId: string, newRoute: string, reason: string, buyerName: string = 'Buyer', newSupplierId?: string) {
  const res = await fetch(`${API_BASE}/api/buyer/requirements/${groupId}/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_route: newRoute, reason, buyer_name: buyerName, new_supplier_id: newSupplierId })
  });
  if (!res.ok) throw new Error('Failed to override decision');
  return res.json();
}

export async function fetchAuditLogs() {
  const res = await fetch(`${API_BASE}/api/buyer/audit-logs`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

export async function processBatchCSV(file: File, policyVersion?: string, persist: boolean = true) {
  const formData = new FormData();
  formData.append('file', file);
  let url = `${API_BASE}/api/process-batch?persist=${persist}`;
  if (policyVersion) url += `&policy_version=${policyVersion}`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to process batch');
  return res.json();
}

export async function runSampleBatch(policyVersion?: string) {
  let url = `${API_BASE}/api/export-sample?format=json&persist=true`;
  if (policyVersion) url += `&policy_version=${policyVersion}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to run sample batch');
  return res.json();
}

export async function fetchPolicies() {
  const res = await fetch(`${API_BASE}/api/policies`);
  if (!res.ok) throw new Error('Failed to fetch policies');
  return res.json();
}

export async function fetchActivePolicy() {
  const res = await fetch(`${API_BASE}/api/policies/active`);
  if (!res.ok) throw new Error('Failed to fetch active policy');
  return res.json();
}

export async function previewPolicyAmendment(text: string) {
  const res = await fetch(`${API_BASE}/api/policies/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amendment_text: text })
  });
  if (!res.ok) throw new Error('Failed to preview amendment');
  return res.json();
}

export async function previewPolicyAmendmentPDF(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/policies/preview-pdf`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to preview amendment PDF');
  return res.json();
}

export async function createPolicyDraft(parsedData: any, rawText: string, createdBy: string = 'Procurement Manager') {
  const res = await fetch(`${API_BASE}/api/policies/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parsed_data: parsedData, raw_text: rawText, created_by: createdBy })
  });
  if (!res.ok) throw new Error('Failed to create policy draft');
  return res.json();
}

export async function approvePolicyVersion(policyId: number, actor: string = 'Head of Procurement') {
  const res = await fetch(`${API_BASE}/api/policies/${policyId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor })
  });
  if (!res.ok) throw new Error('Failed to approve policy');
  return res.json();
}

export async function rejectPolicyVersion(policyId: number, reason: string = '', actor: string = 'Head of Procurement') {
  const res = await fetch(`${API_BASE}/api/policies/${policyId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor, reason })
  });
  if (!res.ok) throw new Error('Failed to reject policy');
  return res.json();
}

export async function fetchRankings(asOfDate?: string, itemCode?: string, topN?: number) {
  let url = `${API_BASE}/api/rankings`;
  const params = [];
  if (asOfDate) params.push(`as_of_date=${asOfDate}`);
  if (itemCode) params.push(`item_code=${itemCode}`);
  if (topN) params.push(`top_n=${topN}`);
  if (params.length) url += `?${params.join('&')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch rankings');
  return res.json();
}

export async function fetchSourcingSuggestions(itemCode: string, asOfDate?: string, count: number = 3) {
  let url = `${API_BASE}/api/rankings/suggestions?item_code=${itemCode}&count=${count}`;
  if (asOfDate) url += `&as_of_date=${asOfDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch sourcing suggestions');
  return res.json();
}

export async function fetchContracts() {
  const res = await fetch(`${API_BASE}/api/contracts`);
  if (!res.ok) throw new Error('Failed to fetch contracts');
  return res.json();
}

export async function uploadContractPDF(file: File, addedBy: string = 'Procurement Buyer') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('added_by', addedBy);
  const res = await fetch(`${API_BASE}/api/contracts/upload-pdf`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload contract PDF');
  return res.json();
}
