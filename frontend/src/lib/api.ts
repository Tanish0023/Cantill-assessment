const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/api/data/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
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

export async function fetchWorkspaceRequirements() {
  const res = await fetch(`${API_BASE}/api/buyer/requirements`);
  if (!res.ok) throw new Error('Failed to fetch workspace requirements');
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

export async function overrideDecision(groupId: string, newRoute: string, reason: string, buyerName: string = 'Buyer') {
  const res = await fetch(`${API_BASE}/api/buyer/requirements/${groupId}/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_route: newRoute, reason, buyer_name: buyerName })
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

export async function previewPolicyAmendment(text: string) {
  const res = await fetch(`${API_BASE}/api/policies/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amendment_text: text })
  });
  if (!res.ok) throw new Error('Failed to preview amendment');
  return res.json();
}

export async function createPolicyDraft(parsedData: any, rawText: string) {
  const res = await fetch(`${API_BASE}/api/policies/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parsed_data: parsedData, raw_text: rawText, created_by: 'Procurement Manager' })
  });
  if (!res.ok) throw new Error('Failed to create policy draft');
  return res.json();
}

export async function approvePolicyVersion(policyId: number) {
  const res = await fetch(`${API_BASE}/api/policies/${policyId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: 'Head of Procurement' })
  });
  if (!res.ok) throw new Error('Failed to approve policy');
  return res.json();
}

export async function fetchRankings(asOfDate?: string, itemCode?: string) {
  let url = `${API_BASE}/api/rankings`;
  const params = [];
  if (asOfDate) params.push(`as_of_date=${asOfDate}`);
  if (itemCode) params.push(`item_code=${itemCode}`);
  if (params.length) url += `?${params.join('&')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch rankings');
  return res.json();
}

export async function fetchContracts() {
  const res = await fetch(`${API_BASE}/api/contracts`);
  if (!res.ok) throw new Error('Failed to fetch contracts');
  return res.json();
}

export async function uploadContractPDF(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('added_by', 'Procurement Buyer');
  const res = await fetch(`${API_BASE}/api/contracts/upload-pdf`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload contract PDF');
  return res.json();
}
