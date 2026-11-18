'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { MetricsBar } from '@/components/MetricsBar';
import { ChatScreen } from '@/components/screens/ChatScreen';
import { BuyerScreen } from '@/components/screens/BuyerScreen';
import { BatchScreen } from '@/components/screens/BatchScreen';
import { PolicyScreen } from '@/components/screens/PolicyScreen';
import { RankingsScreen } from '@/components/screens/RankingsScreen';
import { ContractsScreen } from '@/components/screens/ContractsScreen';
import { AuditScreen } from '@/components/screens/AuditScreen';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import * as api from '@/lib/api';

export default function Home() {
  const [activeTab, setActiveTab] = useState<
    'chat' | 'workspace' | 'batch' | 'policies' | 'rankings' | 'contracts' | 'audit'
  >('chat');

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.fetchStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-900 flex flex-col font-sans">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium ${
              notification.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
                : 'bg-red-950 text-red-100 border-red-800'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Navigation & App Brand */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        onRefresh={loadStats}
        loading={loading}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* KPI Metrics Summary Bar */}
        <MetricsBar stats={stats} />

        {/* Screen Switching */}
        {activeTab === 'chat' && (
          <ChatScreen
            onPRConfirmed={() => {
              loadStats();
              setActiveTab('workspace');
            }}
            showNotification={showNotification}
          />
        )}

        {activeTab === 'workspace' && (
          <BuyerScreen showNotification={showNotification} />
        )}

        {activeTab === 'batch' && (
          <BatchScreen showNotification={showNotification} />
        )}

        {activeTab === 'policies' && (
          <PolicyScreen showNotification={showNotification} />
        )}

        {activeTab === 'rankings' && (
          <RankingsScreen showNotification={showNotification} />
        )}

        {activeTab === 'contracts' && (
          <ContractsScreen showNotification={showNotification} />
        )}

        {activeTab === 'audit' && (
          <AuditScreen showNotification={showNotification} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Corvo Engineering Autonomous PR-to-PO Decision Engine · Policy v5.0</span>
          <span className="font-mono text-[11px] text-slate-400">Router-Controller-Repository Architecture</span>
        </div>
      </footer>
    </div>
  );
}
