import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Bot, User, CheckCircle2, AlertTriangle, ArrowRight, 
  Sparkles, RotateCcw, Building, Calendar, Package, DollarSign, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import * as api from '@/lib/api';

interface ChatScreenProps {
  onPRConfirmed?: (pr: any) => void;
  showNotification: (msg: string, type?: 'success' | 'error') => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ onPRConfirmed, showNotification }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; data?: any }>>([
    {
      role: 'assistant',
      text: "Hello! I am Corvo's Autonomous Procurement Assistant powered by Gemini. You can describe your purchase requirement in natural language.\n\nFor example:\n• \"Need 200 nitrile gloves for Chakan plant by next Friday\"\n• \"Require 15 NOS MS sheet 3mm 1250x2500 for Bhosari plant urgently\"\n• \"Need 4 NOS EOT crane 5 ton for Pune plant by Dec 1\""
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [extractedPR, setExtractedPR] = useState<any>(null);
  const [confirmedResult, setConfirmedResult] = useState<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    "Need 200 nitrile coated gloves for Chakan by 2026-11-20",
    "Urgent 15 NOS MS sheet 3mm 1250x2500 for Bhosari plant need by 2026-11-15",
    "Require 500 ball bearings 6205-2RS for Bhosari plant need by next month",
    "Need 1 NOS Drinking water purifier 50 LPH for Pune plant estimated 141100 INR"
  ];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, extractedPR, confirmedResult]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await api.sendChatMessage(userMsg, extractedPR);
      const reply = res.reply || res.response || "I have received your request.";
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
      const stateObj = res.state || res.extracted_pr;
      if (stateObj) {
        setExtractedPR(stateObj);
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', text: "Sorry, I encountered an error communicating with the intake service: " + (err.message || 'Please check connection.') }
      ]);
      showNotification("Failed to send chat message: " + (err.message || ''), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!extractedPR || confirming) return;
    setConfirming(true);

    try {
      const payload = {
        ...extractedPR,
        description: extractedPR.description || extractedPR.matched_description || extractedPR.item_description || "General Item",
      };
      const res = await api.confirmChatPR(payload);
      setConfirmedResult(res);
      showNotification(`Purchase Request ${res.pr_no || ''} confirmed and evaluated!`, "success");
      if (onPRConfirmed) onPRConfirmed(res);
    } catch (err: any) {
      showNotification("Failed to confirm and evaluate PR: " + err.message, "error");
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        role: 'assistant',
        text: "Session reset. How can I help you with your procurement requisition today?"
      }
    ]);
    setExtractedPR(null);
    setConfirmedResult(null);
    setInput('');
  };

  const isComplete = Boolean((extractedPR?.matched_description || extractedPR?.item_description) && extractedPR?.quantity && extractedPR?.plant);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Chat Window */}
      <div className="lg:col-span-7 flex flex-col h-[740px] bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Chat Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-slate-900 text-white rounded-md">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 leading-none">PR Conversational Intake</h3>
              <p className="text-xs text-slate-500 mt-0.5">Gemini 2.5 Flash entity extraction</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 text-xs text-slate-500">
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset
          </Button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 text-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-xs ${
                  m.role === 'user'
                    ? 'bg-slate-900 text-white rounded-br-xs'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs whitespace-pre-line'
                }`}
              >
                {m.text}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs font-semibold">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center space-x-2.5 text-slate-500 text-xs pl-2">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center animate-pulse">
                <Bot className="w-4 h-4 text-slate-600" />
              </div>
              <div className="bg-white border border-slate-200 px-3 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                <span className="text-xs text-slate-500 ml-1">Analyzing requisition parameters...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Prompts */}
        <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center space-x-2 overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center">
            <Sparkles className="w-3 h-3 mr-1 text-amber-500" /> Examples:
          </span>
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {q.substring(0, 36)}...
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Need 500 ball bearings for Bhosari plant urgently by Nov 25..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim() || loading} className="px-4">
              <Send className="w-4 h-4 mr-1.5" />
              Send
            </Button>
          </form>
        </div>
      </div>

      {/* Right Extracted Parameter Preview & Instant Evaluation */}
      <div className="lg:col-span-5 flex flex-col space-y-4">
        {/* Live Parameter Card */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center text-slate-900">
                <Package className="w-4 h-4 mr-2 text-blue-600" />
                Live Extracted Requisition
              </CardTitle>
              {extractedPR && (
                <Badge variant={isComplete ? "success" : "warning"}>
                  {isComplete ? "Ready for Confirmation" : "Missing Details"}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-slate-500">
              Parameters extracted from conversation
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-3">
            {!extractedPR ? (
              <div className="py-8 text-center text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-300" />
                <p className="text-xs">No requisition details detected yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Start chatting on the left to extract PR entities.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="col-span-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Description
                  </span>
                  <span className="font-semibold text-slate-900 text-sm flex items-center justify-between">
                    <span>{extractedPR.matched_description || extractedPR.item_description || <span className="text-red-500 italic">Missing description</span>}</span>
                    {extractedPR.resolved_item_code && extractedPR.resolved_item_code !== 'NEW' && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {extractedPR.resolved_item_code}
                      </Badge>
                    )}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Quantity
                  </span>
                  <span className="font-semibold text-slate-900">
                    {extractedPR.quantity ? `${extractedPR.quantity} ${extractedPR.uom || 'NOS'}` : <span className="text-red-500 italic">Missing qty</span>}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Plant
                  </span>
                  <span className="font-semibold text-slate-900">
                    {extractedPR.plant ? (
                      <Badge variant="outline" className="font-bold">
                        {extractedPR.plant}
                      </Badge>
                    ) : (
                      <span className="text-red-500 italic">Missing plant</span>
                    )}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Need-By Date
                  </span>
                  <span className="font-semibold text-slate-900">
                    {extractedPR.need_by_date || 'Standard (+14d)'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Urgency
                  </span>
                  <span className="font-semibold text-slate-900">
                    <Badge variant={extractedPR.urgency?.toLowerCase() === 'emergency' ? 'destructive' : extractedPR.urgency?.toLowerCase() === 'urgent' ? 'warning' : 'secondary'}>
                      {extractedPR.urgency || 'Normal'}
                    </Badge>
                  </span>
                </div>

                {extractedPR.estimated_unit_price && (
                  <div className="col-span-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                      Estimated Unit Price
                    </span>
                    <span className="font-semibold text-slate-900">
                      ₹{Number(extractedPR.estimated_unit_price).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>

          {extractedPR && (
            <CardFooter className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                {isComplete ? "Ready to create PR and evaluate" : "Provide missing details via chat"}
              </span>
              <Button
                onClick={handleConfirm}
                disabled={!isComplete || confirming}
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {confirming ? (
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Evaluating...</span>
                  </div>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Confirm & Evaluate PR
                  </>
                )}
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Live Evaluation Result Card */}
        {confirmedResult && (
          <Card className="border-emerald-200 bg-emerald-50/30 shadow-xs animate-in zoom-in-95 duration-150">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-emerald-900 flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2" />
                  Instant Policy Evaluation
                </CardTitle>
                <Badge variant={confirmedResult.decision === 'PO' ? 'success' : 'warning'}>
                  {confirmedResult.decision === 'PO' ? 'PO Generated' : 'Sourcing Required'}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-600">
                Requisition assigned to <span className="font-semibold">{confirmedResult.group_id}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2.5 text-xs pt-1">
              <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-emerald-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Decision Route</span>
                  <Badge variant="outline" className="font-bold text-slate-800 mt-0.5">
                    {confirmedResult.route}
                  </Badge>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Awarded Supplier</span>
                  <span className="font-bold text-slate-900 block mt-0.5">
                    {confirmedResult.supplier_id || 'Quotes / Sourcing Needed'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Unit Price</span>
                  <span className="font-semibold text-slate-800">
                    {confirmedResult.unit_price ? `₹${Number(confirmedResult.unit_price).toLocaleString()}` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Requirement Value</span>
                  <span className="font-bold text-slate-900">
                    ₹{Number(confirmedResult.group_value_inr || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {confirmedResult.reason && (
                <div className="p-2.5 rounded bg-white border border-emerald-100 text-slate-700">
                  <span className="font-semibold text-slate-900">Policy Reason:</span> {confirmedResult.reason}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
