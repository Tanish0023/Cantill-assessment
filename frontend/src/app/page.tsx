'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, FileText, Upload, ShieldCheck, Award, Layers,
  CheckCircle2, AlertTriangle, Clock, Search, Download, ArrowRight,
  RefreshCw, PlusCircle, Building2, ExternalLink, Filter, HelpCircle,
  FileCheck, ChevronRight, XCircle, UserCheck
} from 'lucide-react';
import * as api from '@/lib/api';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'workspace' | 'batch' | 'policies' | 'rankings' | 'contracts' | 'audit'>('chat');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; data?: any }>>([
    {
      role: 'assistant',
      text: "Hello! I'm your Corvo Procurement Assistant. Tell me what you need, for example:\n• \"Need 200 nitrile gloves for Chakan by next Friday\"\n• \"Require 15 NOS of MS sheet 3mm for Bhosari plant urgently\"\n• \"Need 5 JOB CMM calibration service for Bhosari by Nov 30\""
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatState, setChatState] = useState<any>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [confirmedPrResult, setConfirmedPrResult] = useState<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Workspace State
  const [requirements, setRequirements] = useState<any[]>([]);
  const [selectedReqDetails, setSelectedReqDetails] = useState<any>(null);
  const [overrideModal, setOverrideModal] = useState<{ groupId: string; currentRoute: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideRoute, setOverrideRoute] = useState('RFQ');
  const [workspaceFilter, setWorkspaceFilter] = useState('');

  // Batch State
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchPolicyVer, setBatchPolicyVer] = useState('');
  const [batchSearch, setBatchSearch] = useState('');

  // Policy State
  const [policies, setPolicies] = useState<any[]>([]);
  const [amendmentText, setAmendmentText] = useState('');
  const [amendmentPreview, setAmendmentPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Rankings State
  const [rankingsData, setRankingsData] = useState<any>(null);
  const [rankingDate, setRankingDate] = useState('2026-11-01');
  const [rankingSearch, setRankingSearch] = useState('');

  // Contracts State
  const [contractsList, setContractsList] = useState<any[]>([]);
  const [contractUploadModal, setContractUploadModal] = useState(false);
  const [contractFile, setContractFile] = useState<File | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadInitialData = async () => {
    try {
      const [s, p, c] = await Promise.all([
        api.fetchStats(),
        api.fetchPolicies(),
        api.fetchContracts()
      ]);
      setStats(s);
      setPolicies(p);
      setContractsList(c);
    } catch (err: any) {
      console.error('Error loading initial data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'workspace') {
      loadWorkspace();
    } else if (activeTab === 'rankings') {
      loadRankings();
    } else if (activeTab === 'contracts') {
      loadContracts();
    } else if (activeTab === 'policies') {
      loadPolicies();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Loaders
  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const data = await api.fetchWorkspaceRequirements();
      setRequirements(data);
    } catch (err: any) {
      showNotification('Failed to load requirements', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRankings = async () => {
    setLoading(true);
    try {
      const data = await api.fetchRankings(rankingDate);
      setRankingsData(data);
    } catch (err: any) {
      showNotification('Failed to load rankings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadContracts = async () => {
    try {
      const data = await api.fetchContracts();
      setContractsList(data);
    } catch (err: any) {
      showNotification('Failed to load contracts', 'error');
    }
  };

  const loadPolicies = async () => {
    try {
      const data = await api.fetchPolicies();
      setPolicies(data);
    } catch (err: any) {
      showNotification('Failed to load policies', 'error');
    }
  };

  const loadAuditLogs = async () => {
    try {
      const data = await api.fetchAuditLogs();
      setAuditLogs(data);
    } catch (err: any) {
      showNotification('Failed to load audit logs', 'error');
    }
  };

  // Chat Handlers
  const handleSendChat = async (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim()) return;

    const userMsg = { role: 'user' as const, text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    setConfirmedPrResult(null);

    try {
      const res = await api.sendChatMessage(text, chatState);
      setChatState(res.state);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: res.reply,
        data: res
      }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Sorry, I encountered an error processing your message. Please try again.'
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleConfirmPR = async () => {
    if (!chatState) return;
    setChatLoading(true);
    try {
      const res = await api.confirmChatPR({
        plant: chatState.plant,
        item_code: chatState.resolved_item_code !== 'NEW' ? chatState.resolved_item_code : undefined,
        description: chatState.item_description,
        quantity: chatState.quantity,
        uom: chatState.uom || 'NOS',
        need_by_date: chatState.need_by_date,
        urgency: chatState.urgency || 'Normal',
        estimated_unit_price: chatState.estimated_unit_price
      });
      setConfirmedPrResult(res);
      setChatState(null);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: `✅ Purchase Request **${res.pr_no}** created successfully!\n\nProcurement Decision: **${res.decision.route}** (${res.decision.decision})\nRequirement Value: **₹${Number(res.decision.group_value_inr).toLocaleString('en-IN')}**\n${res.decision.supplier_id ? `Supplier: **${res.decision.supplier_id}**\n` : ''}${res.decision.po_id ? `PO ID: **${res.decision.po_id}**\n` : ''}Reason: ${res.decision.reason}`
      }]);
      showNotification(`PR ${res.pr_no} confirmed!`);
      loadInitialData();
    } catch (err: any) {
      showNotification('Failed to confirm PR', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  // Workspace Actions
  const handleApprove = async (groupId: string) => {
    try {
      await api.approveDecision(groupId, 'Buyer (Tanish)');
      showNotification(`Requirement ${groupId} approved!`);
      loadWorkspace();
    } catch (err: any) {
      showNotification('Failed to approve decision', 'error');
    }
  };

  const handleOverrideSubmit = async () => {
    if (!overrideModal || !overrideReason.trim()) {
      showNotification('Mandatory written reason required for override', 'error');
      return;
    }
    try {
      await api.overrideDecision(overrideModal.groupId, overrideRoute, overrideReason, 'Buyer (Tanish)');
      showNotification(`Decision for ${overrideModal.groupId} overridden to ${overrideRoute}`);
      setOverrideModal(null);
      setOverrideReason('');
      loadWorkspace();
    } catch (err: any) {
      showNotification('Failed to override decision', 'error');
    }
  };

  // Batch Handlers
  const handleProcessBatchUpload = async () => {
    if (!batchFile) return;
    setLoading(true);
    try {
      const data = await api.processBatchCSV(batchFile, batchPolicyVer || undefined);
      setBatchResults(data.results);
      showNotification(`Processed ${data.total_lines} PR lines successfully!`);
    } catch (err: any) {
      showNotification('Failed to process batch CSV', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRunSampleBatch = async () => {
    setLoading(true);
    try {
      const data = await api.runSampleBatch(batchPolicyVer || undefined);
      setBatchResults(data.results);
      showNotification(`Sample batch processed: ${data.total_lines} lines!`);
    } catch (err: any) {
      showNotification('Failed to run sample batch', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Policy Handlers
  const handlePreviewAmendment = async () => {
    if (!amendmentText.trim()) return;
    setPreviewLoading(true);
    try {
      const prev = await api.previewPolicyAmendment(amendmentText);
      setAmendmentPreview(prev);
    } catch (err: any) {
      showNotification('Failed to parse policy amendment', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateAndApprovePolicy = async () => {
    if (!amendmentPreview) return;
    setLoading(true);
    try {
      const draft = await api.createPolicyDraft(amendmentPreview, amendmentText);
      await api.approvePolicyVersion(draft.policy_id);
      showNotification(`Policy amendment v${amendmentPreview.new_version} activated successfully!`);
      setAmendmentText('');
      setAmendmentPreview(null);
      loadPolicies();
    } catch (err: any) {
      showNotification('Failed to activate policy amendment', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Contract Upload
  const handleContractUpload = async () => {
    if (!contractFile) return;
    setLoading(true);
    try {
      const res = await api.uploadContractPDF(contractFile);
      showNotification(`Contract ${res.contract_id} uploaded and activated!`);
      setContractUploadModal(false);
      setContractFile(null);
      loadContracts();
    } catch (err: any) {
      showNotification('Failed to upload contract PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-medium border flex items-center space-x-2 ${
          notification.type === 'success' ? 'bg-emerald-950 border-emerald-600 text-emerald-200' : 'bg-rose-950 border-rose-600 text-rose-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
              C
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-100 tracking-tight text-lg">Corvo Engineering</span>
                <span className="text-[11px] font-medium bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full">
                  Policy v{policies.find(p => p.status === 'ACTIVE')?.version || '5.0'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Autonomous PR-to-PO Procurement Engine</p>
            </div>
          </div>

          {/* Quick Metrics */}
          {stats && (
            <div className="hidden md:flex items-center space-x-6 text-xs text-slate-400">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>DB Connected</span>
              </div>
              <div className="flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>{stats.items} Items</span>
              </div>
              <div className="flex items-center space-x-1">
                <FileCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>{stats.contracts} Contracts</span>
              </div>
              <div className="flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>2 Plants (PUN1/CHK1)</span>
              </div>
            </div>
          )}
        </div>

        {/* Tab Bar */}
        <div className="max-w-7xl mx-auto px-4 flex space-x-1 overflow-x-auto text-sm border-t border-slate-800/60 scrollbar-none">
          {[
            { id: 'chat', label: 'Chat Intake', icon: MessageSquare },
            { id: 'workspace', label: 'Buyer Workspace', icon: CheckCircle2 },
            { id: 'batch', label: 'Batch Processing & Export', icon: Upload },
            { id: 'policies', label: 'Policy Management', icon: ShieldCheck },
            { id: 'rankings', label: 'Supplier Rankings', icon: Award },
            { id: 'contracts', label: 'Contracts', icon: FileText },
            { id: 'audit', label: 'Audit Trail', icon: Clock },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-3.5 border-b-2 font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {/* TAB 1: CHAT INTAKE */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-170px)]">
            <div className="lg:col-span-2 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              {/* Chat Header */}
              <div className="px-4 py-3 bg-slate-800/70 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <span className="font-medium text-sm text-slate-200">Conversational Purchase Requisition</span>
                </div>
                <span className="text-xs text-slate-400">Powered by Gemini AI (v1beta)</span>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-md'
                        : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-bl-none shadow'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 border border-slate-700 text-slate-400 rounded-2xl px-4 py-3 text-sm flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>Understanding your purchase request...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Sample Quick Prompt Chips */}
              <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/60 flex items-center space-x-2 overflow-x-auto text-xs text-slate-400">
                <span className="text-slate-500 font-medium">Quick suggestions:</span>
                {[
                  "Need 200 nitrile gloves for Chakan by next Friday",
                  "15 NOS of MS sheet 3mm for PUN1 plant urgently",
                  "Need 5 JOB CMM calibration service for PUN1 by Nov 30",
                  "Need 1 NOS Drinking water purifier 50 LPH for PUN1"
                ].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendChat(s)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form
                onSubmit={e => { e.preventDefault(); handleSendChat(); }}
                className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Type your purchase need (e.g. 'Need 50 pneumatic cylinders for Chakan next week')..."
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium px-4 py-2.5 rounded-lg text-sm flex items-center space-x-1.5 transition-colors"
                >
                  <span>Send</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Extracted PR Details Card & Confirmation */}
            <div className="flex flex-col space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex-1">
                <h3 className="font-semibold text-slate-100 text-base mb-3 flex items-center space-x-2">
                  <FileCheck className="w-4 h-4 text-indigo-400" />
                  <span>Request Information Summary</span>
                </h3>

                {chatState ? (
                  <div className="space-y-3 text-sm">
                    <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <span>Resolved Item:</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          chatState.resolved_item_code === 'NEW'
                            ? 'bg-amber-900/60 text-amber-300 border border-amber-700'
                            : 'bg-indigo-900/60 text-indigo-300 border border-indigo-700'
                        }`}>
                          {chatState.resolved_item_code || 'Matching...'}
                        </span>
                      </div>
                      <p className="font-medium text-slate-200">
                        {chatState.matched_description || chatState.item_description || 'Pending'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80">
                        <span className="text-slate-400 block mb-1">Quantity & UoM:</span>
                        <span className="font-semibold text-slate-100 text-sm">
                          {chatState.quantity ? `${chatState.quantity} ${chatState.uom || 'NOS'}` : 'Missing'}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80">
                        <span className="text-slate-400 block mb-1">Plant:</span>
                        <span className="font-semibold text-slate-100 text-sm">
                          {chatState.plant ? `${chatState.plant} (${chatState.plant === 'PUN1' ? 'Bhosari' : 'Chakan'})` : 'Missing'}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80">
                        <span className="text-slate-400 block mb-1">Need-by Date:</span>
                        <span className="font-semibold text-slate-100 text-sm">
                          {chatState.need_by_date || 'Missing'}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80">
                        <span className="text-slate-400 block mb-1">Urgency:</span>
                        <span className={`font-semibold text-sm ${chatState.urgency === 'Emergency' ? 'text-rose-400' : 'text-slate-200'}`}>
                          {chatState.urgency || 'Normal'}
                        </span>
                      </div>
                    </div>

                    {chatState.resolved_item_code === 'NEW' && (
                      <div className="bg-amber-950/40 border border-amber-800/50 p-2.5 rounded text-xs text-amber-200">
                        <span className="font-semibold">New Item Notice:</span> This item does not exist in Corvo's item master. Estimated unit price: ₹{chatState.estimated_unit_price || 0}. Will route to NEW_ITEM_SOURCING.
                      </div>
                    )}

                    {/* Missing Fields Warning */}
                    {chatMessages[chatMessages.length - 1]?.data?.missing_fields?.length > 0 && (
                      <div className="bg-rose-950/30 border border-rose-900/60 p-2.5 rounded text-xs text-rose-300">
                        <span className="font-semibold">Missing Information:</span> {chatMessages[chatMessages.length - 1].data.missing_fields.join(', ')}
                      </div>
                    )}

                    {/* Confirmation Button */}
                    <button
                      onClick={handleConfirmPR}
                      disabled={chatMessages[chatMessages.length - 1]?.data?.missing_fields?.length > 0 || chatLoading}
                      className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-emerald-600/20"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Confirm & Submit PR</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    <p>Start typing in the chat to raise a purchase requisition.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BUYER WORKSPACE */}
        {activeTab === 'workspace' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Buyer Workspace & Decision Audit</h2>
                <p className="text-xs text-slate-400">Review policy-driven outcomes, approve POs, or record overrides</p>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by item, plant, route..."
                    value={workspaceFilter}
                    onChange={e => setWorkspaceFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={loadWorkspace}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Requirements Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Group ID</th>
                      <th className="py-3 px-4">Item Code & Name</th>
                      <th className="py-3 px-4">Plant</th>
                      <th className="py-3 px-4">Total Qty</th>
                      <th className="py-3 px-4">Requirement Value</th>
                      <th className="py-3 px-4">Route & Decision</th>
                      <th className="py-3 px-4">Supplier / Suggestions</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {requirements
                      .filter(r => {
                        if (!workspaceFilter) return true;
                        const q = workspaceFilter.toLowerCase();
                        return (
                          r.group_id.toLowerCase().includes(q) ||
                          r.item_code.toLowerCase().includes(q) ||
                          r.item_description.toLowerCase().includes(q) ||
                          r.decision?.route?.toLowerCase().includes(q)
                        );
                      })
                      .map((req, i) => {
                        const d = req.decision;
                        const routeColor = 
                          d?.route === 'CONTRACT_PO' ? 'bg-blue-900/60 text-blue-300 border-blue-700' :
                          d?.route === 'SPOT_PO' ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700' :
                          d?.route === 'EMERGENCY_PO' ? 'bg-rose-900/60 text-rose-300 border-rose-700' :
                          d?.route === 'RFQ' ? 'bg-purple-900/60 text-purple-300 border-purple-700' :
                          d?.route === 'RFP' ? 'bg-amber-900/60 text-amber-300 border-amber-700' :
                          d?.route === 'CAPEX_SOURCING' ? 'bg-orange-900/60 text-orange-300 border-orange-700' :
                          'bg-slate-800 text-slate-300 border-slate-700';

                        return (
                          <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-mono font-medium text-indigo-400">{req.group_id}</td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-200 block">{req.item_code}</span>
                              <span className="text-slate-400 text-[11px] truncate block max-w-xs">{req.item_description}</span>
                            </td>
                            <td className="py-3 px-4 font-medium">{req.plant}</td>
                            <td className="py-3 px-4 font-mono">{req.total_quantity} {req.uom}</td>
                            <td className="py-3 px-4 font-semibold text-slate-100">
                              ₹{Number(req.group_value_inr).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${routeColor}`}>
                                {d?.route || 'PENDING'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {d?.supplier_id ? (
                                <span className="font-medium text-slate-200">{d.supplier_id} ({d.supplier_name})</span>
                              ) : d?.suggested_supplier_ids ? (
                                <span className="text-slate-400 font-mono text-[11px]">Sugg: {d.suggested_supplier_ids}</span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                req.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                                req.status === 'OVERRIDDEN' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={async () => {
                                  const det = await api.fetchRequirementDetails(req.group_id);
                                  setSelectedReqDetails(det);
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded text-xs border border-slate-700"
                              >
                                Details
                              </button>
                              {req.status !== 'APPROVED' && (
                                <button
                                  onClick={() => handleApprove(req.group_id)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs font-medium"
                                >
                                  Approve
                                </button>
                              )}
                              <button
                                onClick={() => setOverrideModal({ groupId: req.group_id, currentRoute: d?.route || 'RFQ' })}
                                className="bg-amber-600/80 hover:bg-amber-500 text-white px-2.5 py-1 rounded text-xs font-medium"
                              >
                                Override
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Requirement Details Modal */}
            {selectedReqDetails && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-100">Requirement Details: {selectedReqDetails.requirement.group_id}</h3>
                      <p className="text-xs text-slate-400">Created: {selectedReqDetails.requirement.requirement_date} • Plant: {selectedReqDetails.requirement.plant}</p>
                    </div>
                    <button onClick={() => setSelectedReqDetails(null)} className="text-slate-400 hover:text-slate-100">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-950 p-3 rounded border border-slate-800">
                      <span className="text-slate-400 block mb-1">Item:</span>
                      <span className="font-semibold text-slate-200">{selectedReqDetails.requirement.item_code} - {selectedReqDetails.requirement.item_description}</span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded border border-slate-800">
                      <span className="text-slate-400 block mb-1">Requirement Value:</span>
                      <span className="font-semibold text-slate-200">₹{Number(selectedReqDetails.requirement.group_value_inr).toLocaleString('en-IN')} ({selectedReqDetails.requirement.total_quantity} {selectedReqDetails.requirement.uom})</span>
                    </div>
                  </div>

                  {/* Decision Explanation Card */}
                  {selectedReqDetails.decision && (
                    <div className="bg-indigo-950/30 border border-indigo-900/60 p-4 rounded-lg space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-indigo-300">Policy Decision: {selectedReqDetails.decision.route} ({selectedReqDetails.decision.decision})</span>
                        <span className="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded text-[10px]">Clause {selectedReqDetails.decision.applied_clause}</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{selectedReqDetails.decision.reason}</p>
                      {selectedReqDetails.decision.reference_doc && (
                        <p className="text-slate-400 font-mono text-[11px]">Supporting Document: {selectedReqDetails.decision.reference_doc}</p>
                      )}
                      {selectedReqDetails.decision.override_reason && (
                        <div className="mt-2 pt-2 border-t border-indigo-800/40 text-amber-300">
                          <span className="font-semibold">Override Reason:</span> {selectedReqDetails.decision.override_reason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audit Trail */}
                  <div>
                    <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider mb-2">Audit History</h4>
                    <div className="space-y-1.5 text-xs">
                      {selectedReqDetails.audit_trail.map((a: any, idx: number) => (
                        <div key={idx} className="bg-slate-950 border border-slate-800 p-2.5 rounded flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-slate-300">{a.action}</span>
                            <span className="text-slate-500 text-[11px] ml-2">by {a.performed_by}</span>
                            {a.comment && <p className="text-slate-400 text-[11px] mt-0.5">{a.comment}</p>}
                          </div>
                          <span className="text-slate-500 text-[10px] whitespace-nowrap">{a.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setSelectedReqDetails(null)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-medium"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Override Modal */}
            {overrideModal && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-bold text-slate-100">Override Decision: {overrideModal.groupId}</h3>
                    <button onClick={() => setOverrideModal(null)} className="text-slate-400 hover:text-slate-100">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">New Procurement Route:</label>
                      <select
                        value={overrideRoute}
                        onChange={e => setOverrideRoute(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100"
                      >
                        <option value="RFQ">RFQ (Request for Quotation)</option>
                        <option value="RFP">RFP (Request for Proposal)</option>
                        <option value="CONTRACT_PO">CONTRACT_PO (Direct PO against Contract)</option>
                        <option value="SPOT_PO">SPOT_PO (Spot Purchase Order)</option>
                        <option value="EMERGENCY_PO">EMERGENCY_PO (Emergency Order)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">
                        Mandatory Written Override Reason: <span className="text-rose-400">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                        placeholder="Explain business justification for overriding policy outcome..."
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setOverrideModal(null)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleOverrideSubmit}
                      disabled={!overrideReason.trim()}
                      className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-4 py-2 rounded text-xs font-medium"
                    >
                      Submit Override
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BATCH PROCESSING & CSV EXPORT */}
        {activeTab === 'batch' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Batch Processing & Decision Export</h2>
                <p className="text-xs text-slate-400">Process purchase request batch CSVs under active or historical policy</p>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/export-sample?format=csv`}
                  download="sample_batch_decisions.csv"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-md shadow-emerald-600/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Decisions CSV (13 cols)</span>
                </a>
              </div>
            </div>

            {/* Upload & Action Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-slate-200">Upload PR Batch CSV</h3>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400">Policy Version:</span>
                    <select
                      value={batchPolicyVer}
                      onChange={e => setBatchPolicyVer(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 text-xs"
                    >
                      <option value="">Default Active</option>
                      {policies.map(p => (
                        <option key={p.id} value={p.version}>v{p.version} ({p.status})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={e => setBatchFile(e.target.files?.[0] || null)}
                    className="flex-1 text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer"
                  />
                  <button
                    onClick={handleProcessBatchUpload}
                    disabled={!batchFile || loading}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors whitespace-nowrap"
                  >
                    Process Uploaded File
                  </button>
                </div>
              </div>

              {/* Sample Batch 1-Click Run */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-slate-200 mb-1">Kit Sample Batch</h3>
                  <p className="text-xs text-slate-400 mb-3">186 PR lines from November 2026. Run verification with 1 click.</p>
                </div>
                <button
                  onClick={handleRunSampleBatch}
                  disabled={loading}
                  className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium py-2 rounded-lg text-xs flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Run Sample Batch (186 lines)</span>
                </button>
              </div>
            </div>

            {/* Results Table */}
            {batchResults.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-3 p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm text-slate-200">Batch Processing Results ({batchResults.length} PR lines)</span>
                  <input
                    type="text"
                    placeholder="Filter results..."
                    value={batchSearch}
                    onChange={e => setBatchSearch(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-3 py-1 text-xs text-slate-200"
                  />
                </div>

                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px] sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">PR No</th>
                        <th className="py-2.5 px-3">Line</th>
                        <th className="py-2.5 px-3">Resolved Item</th>
                        <th className="py-2.5 px-3">Group ID</th>
                        <th className="py-2.5 px-3">PO ID</th>
                        <th className="py-2.5 px-3">Decision</th>
                        <th className="py-2.5 px-3">Route</th>
                        <th className="py-2.5 px-3">Supplier</th>
                        <th className="py-2.5 px-3">Unit Price</th>
                        <th className="py-2.5 px-3">Group Value</th>
                        <th className="py-2.5 px-3">Suggested Suppliers</th>
                        <th className="py-2.5 px-3">Policy Ver</th>
                        <th className="py-2.5 px-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {batchResults
                        .filter(r => {
                          if (!batchSearch) return true;
                          const q = batchSearch.toLowerCase();
                          return (
                            r.pr_no.toLowerCase().includes(q) ||
                            r.resolved_item_code.toLowerCase().includes(q) ||
                            r.route.toLowerCase().includes(q) ||
                            (r.supplier_id && r.supplier_id.toLowerCase().includes(q))
                          );
                        })
                        .map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40 font-mono text-[11px]">
                            <td className="py-2 px-3 font-semibold text-slate-200">{row.pr_no}</td>
                            <td className="py-2 px-3">{row.pr_line}</td>
                            <td className="py-2 px-3 text-indigo-400">{row.resolved_item_code}</td>
                            <td className="py-2 px-3 text-slate-400">{row.group_id}</td>
                            <td className="py-2 px-3 text-emerald-400">{row.po_id || '—'}</td>
                            <td className="py-2 px-3">{row.decision}</td>
                            <td className="py-2 px-3 font-semibold text-slate-200">{row.route}</td>
                            <td className="py-2 px-3">{row.supplier_id || '—'}</td>
                            <td className="py-2 px-3 font-sans">₹{row.unit_price ? Number(row.unit_price).toLocaleString('en-IN') : '—'}</td>
                            <td className="py-2 px-3 font-sans font-semibold text-slate-100">₹{Number(row.group_value_inr).toLocaleString('en-IN')}</td>
                            <td className="py-2 px-3 text-slate-400">{row.suggested_supplier_ids || '—'}</td>
                            <td className="py-2 px-3">v{row.policy_version}</td>
                            <td className="py-2 px-3 font-sans text-slate-400 max-w-xs truncate" title={row.reason}>{row.reason}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: POLICY MANAGEMENT */}
        {activeTab === 'policies' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Versioned Policy Management</h2>
              <p className="text-xs text-slate-400">Policies are stored as configurable data. Upload amendments to preview diffs and activate without code changes.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upload Amendment Form */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                <h3 className="font-semibold text-sm text-slate-200">Upload or Describe Policy Amendment</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Paste the policy amendment text or describe changes. Gemini AI parses new thresholds, categories, plant conditions, or outcomes into structured rules.
                </p>

                <textarea
                  rows={6}
                  value={amendmentText}
                  onChange={e => setAmendmentText(e.target.value)}
                  placeholder="Paste policy amendment text, e.g.:&#10;Corvo Engineering Procurement Policy Amendment&#10;Version 5.1, Effective 1 December 2026&#10;Spot PO limit is raised to INR 300,000 for all plants."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setAmendmentText("Corvo Engineering Pvt Ltd\nProcurement Policy Amendment\nVersion 5.1\nEffective 1 December 2026\nThe Spot PO limit is raised to INR 300,000 for all plants to reduce sourcing cycle time.")}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Load sample amendment
                  </button>
                  <button
                    onClick={handlePreviewAmendment}
                    disabled={!amendmentText.trim() || previewLoading}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
                    <span>Analyze & Preview Changes</span>
                  </button>
                </div>
              </div>

              {/* Amendment Preview & Activation Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-slate-200 mb-2">Plain-Language Change Preview</h3>
                  {amendmentPreview ? (
                    <div className="space-y-3 text-xs">
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span className="text-indigo-400">Target Version: v{amendmentPreview.new_version}</span>
                          <span className="text-slate-400">Effective: {amendmentPreview.effective_date}</span>
                        </div>
                        <p className="text-slate-300">{amendmentPreview.change_summary}</p>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-1.5">
                        <span className="font-semibold text-slate-300 block mb-1">Impact Preview:</span>
                        <div className="whitespace-pre-wrap text-slate-400 leading-relaxed font-sans">
                          {amendmentPreview.plain_language_preview}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Analyze an amendment on the left to see the AI-generated impact preview before activating.
                    </div>
                  )}
                </div>

                {amendmentPreview && (
                  <div className="pt-4 border-t border-slate-800 flex justify-end space-x-2">
                    <button
                      onClick={() => setAmendmentPreview(null)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded text-xs"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={handleCreateAndApprovePolicy}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-xs font-semibold shadow-lg shadow-emerald-600/20"
                    >
                      Approve & Activate v{amendmentPreview.new_version}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Policy Version History Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm text-slate-200">Policy Version History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Version</th>
                      <th className="py-2.5 px-3">Effective Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Summary</th>
                      <th className="py-2.5 px-3">Approved By</th>
                      <th className="py-2.5 px-3">Approved At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {policies.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-indigo-400">v{p.version}</td>
                        <td className="py-2.5 px-3 font-mono">{p.effective_date}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            p.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                            p.status === 'PENDING_APPROVAL' ? 'bg-amber-950 text-amber-300 border border-amber-700' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-sm truncate">{p.change_summary || p.title}</td>
                        <td className="py-2.5 px-3 text-slate-400">{p.approved_by || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px]">{p.approved_at || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SUPPLIER RANKINGS */}
        {activeTab === 'rankings' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Preferred Supplier Rankings (Section 6)</h2>
                <p className="text-xs text-slate-400">Calculated from purchase frequency (548d), recency, contract history, on-time delivery & quality</p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={rankingDate}
                  onChange={e => setRankingDate(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                />
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/rankings/export?as_of_date=${rankingDate}&top_n=3`}
                  download={`supplier_rankings_${rankingDate}.csv`}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV (Top 3)</span>
                </a>
              </div>
            </div>

            {/* Rankings List */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl p-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">As of: <span className="font-semibold text-slate-200">{rankingDate}</span></span>
                <input
                  type="text"
                  placeholder="Filter by item code or name..."
                  value={rankingSearch}
                  onChange={e => setRankingSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-3 py-1 text-xs text-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rankingsData?.items
                  ?.filter((item: any) => {
                    if (!rankingSearch) return true;
                    const q = rankingSearch.toLowerCase();
                    return item.item_code.toLowerCase().includes(q) || item.item_description.toLowerCase().includes(q);
                  })
                  .slice(0, 30)
                  .map((item: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-xs text-indigo-400">{item.item_code}</span>
                          <p className="text-xs font-medium text-slate-200 truncate max-w-[200px]" title={item.item_description}>{item.item_description}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{item.category}</span>
                      </div>

                      <div className="space-y-1.5">
                        {item.rankings.length > 0 ? (
                          item.rankings.map((r: any, rIdx: number) => (
                            <div key={rIdx} className="bg-slate-900/60 p-2 rounded flex justify-between items-center text-xs border border-slate-800/40">
                              <div className="flex items-center space-x-2">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                  r.rank === 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {r.rank}
                                </span>
                                <div>
                                  <span className="font-semibold text-slate-200">{r.supplier_id}</span>
                                  <span className="text-[10px] text-slate-400 block truncate max-w-[120px]">{r.supplier_name}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-slate-200 text-xs block">₹{Number(r.reference_price).toLocaleString('en-IN')}</span>
                                <span className="text-[10px] text-slate-500">Score: {r.score}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-2 text-[11px] text-slate-600">No purchase or contract history in 548d</div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: CONTRACTS */}
        {activeTab === 'contracts' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Rate Contracts Register</h2>
                <p className="text-xs text-slate-400">View active rate contracts, ceilings, remaining headroom, and signed PDF attachments</p>
              </div>

              <button
                onClick={() => setContractUploadModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 shadow"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Upload PDF Contract</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contractsList.map((c, idx) => {
                const rem = c.value_cap - c.consumed_value;
                const pct = Math.min(100, Math.round((c.consumed_value / c.value_cap) * 100));
                return (
                  <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-sm text-indigo-400">{c.contract_id}</span>
                        <p className="text-xs font-semibold text-slate-200">{c.supplier_name} ({c.supplier_id})</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                        c.source_type === 'PDF' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {c.source_type}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Validity:</span>
                        <span className="font-mono text-slate-300">{c.start_date} to {c.end_date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ceiling:</span>
                        <span className="font-semibold text-slate-200">₹{Number(c.value_cap).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Remaining Ceiling:</span>
                        <span className={`font-semibold ${rem <= 50000 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          ₹{Number(rem).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full ${pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Consumed: ₹{Number(c.consumed_value).toLocaleString('en-IN')}</span>
                      <span>{pct}% utilized</span>
                    </div>

                    {/* Schedule A Items */}
                    <div className="pt-2 border-t border-slate-800/80 text-[11px] space-y-1">
                      <span className="text-slate-500 font-semibold block uppercase tracking-wider text-[9px]">Schedule A Lines ({c.lines.length}):</span>
                      {c.lines.map((l: any, lIdx: number) => (
                        <div key={lIdx} className="flex justify-between text-slate-400">
                          <span className="truncate max-w-[180px]">{l.item_code} ({l.description})</span>
                          <span className="font-semibold text-slate-300">₹{Number(l.rate).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Upload PDF Modal */}
            {contractUploadModal && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-bold text-slate-100">Upload Signed Rate Contract PDF</h3>
                    <button onClick={() => setContractUploadModal(false)} className="text-slate-400 hover:text-slate-100">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400">
                    Upload a signed PDF contract. PyMuPDF automatically extracts contract ID, supplier, term, value ceiling, and Schedule A item rates into the decision engine.
                  </p>

                  <input
                    type="file"
                    accept=".pdf"
                    onChange={e => setContractFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer"
                  />

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setContractUploadModal(false)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleContractUpload}
                      disabled={!contractFile || loading}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 rounded text-xs font-medium"
                    >
                      Upload & Integrate
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Procurement Audit Trail</h2>
                <p className="text-xs text-slate-400">Complete record of every buyer approval, override, policy activation, and contract creation</p>
              </div>
              <button
                onClick={loadAuditLogs}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Entity Type</th>
                      <th className="py-2.5 px-4">Entity ID</th>
                      <th className="py-2.5 px-4">Action</th>
                      <th className="py-2.5 px-4">User</th>
                      <th className="py-2.5 px-4">Details / Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {auditLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">{log.timestamp}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-200">{log.entity_type}</td>
                        <td className="py-2.5 px-4 font-mono text-indigo-400">{log.entity_id}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            log.action === 'APPROVE' || log.action === 'APPROVE_AND_ACTIVATE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            log.action === 'OVERRIDE' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300">{log.performed_by}</td>
                        <td className="py-2.5 px-4 text-slate-400 max-w-md truncate">{log.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
