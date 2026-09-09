"use client";

import { useState } from "react";
import {
  Sparkles,
  Send,
  Square,
  Trash2,
  MessageCircle,
  Bot,
  User,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { ReportSummary } from "@/features/reports/types";
import { useAiChat } from "../hooks/useAiChat";

const QUICK_SUGGESTIONS = [
  "Who earned the most?",
  "Slowest operation?",
  "Summarize this report",
  "Compare top 3 employees",
  "خلاصہ بتائیں",
];

interface AiChatPageContentProps {
  summary: ReportSummary | null;
  isLoadingSummary: boolean;
  summaryError: string | null;
}

/**
 * Full-page chat experience for the dedicated /industrial-engineering/ai-chat route.
 */
export function AiChatPageContent({
  summary,
  isLoadingSummary,
  summaryError,
}: AiChatPageContentProps) {
  const [input, setInput] = useState("");

  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
  } = useAiChat();

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !summary || isStreaming) return;
    sendMessage(input.trim(), summary);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickSuggestion = (q: string) => {
    if (!summary || isStreaming) return;
    sendMessage(q, summary);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl
                       bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/20"
          >
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              AI Production Analyst
            </h1>
            <p className="text-xs text-slate-500">
              Powered by Gemini · Ask questions about your production data
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200
                       px-3 py-1.5 text-xs font-medium text-slate-500
                       transition-colors hover:border-red-200 hover:bg-red-50
                       hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Status banner — loading or error for summary */}
      {isLoadingSummary && (
        <div className="flex items-center gap-2 bg-violet-50 border-b border-violet-100 px-6 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
          <p className="text-xs text-violet-700">
            Loading latest production data (all employees, last 30 days)…
          </p>
        </div>
      )}
      {summaryError && (
        <div className="flex items-center gap-2 bg-red-50 border-b border-red-100 px-6 py-2.5">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <p className="text-xs text-red-700">{summaryError}</p>
        </div>
      )}
      {summary && !isLoadingSummary && (
        <div className="flex items-center gap-2 bg-emerald-50 border-b border-emerald-100 px-6 py-2.5">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <p className="text-xs text-emerald-700">
            Ready — {summary.totalCoupons.toLocaleString()} coupons,{" "}
            {summary.totalEmployees} employees, {summary.totalWorkOrders} work
            orders loaded.
          </p>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl
                         bg-gradient-to-br from-violet-100 to-indigo-100"
            >
              <MessageCircle className="h-10 w-10 text-violet-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1.5">
              Ask anything about your production data
            </h3>
            <p className="text-sm text-slate-500 mb-8 max-w-sm">
              I analyze employee productivity, compare operations, identify
              bottlenecks, and generate insights — in English or Urdu.
            </p>

            {/* Quick suggestions */}
            <div className="flex flex-wrap justify-center gap-2.5 max-w-lg">
              {QUICK_SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuickSuggestion(q)}
                  disabled={!summary}
                  className="rounded-full border border-slate-200 bg-white
                             px-4 py-2 text-sm font-medium text-slate-600
                             shadow-sm transition-all duration-200
                             hover:border-violet-300 hover:bg-violet-50
                             hover:text-violet-700 hover:shadow-md
                             disabled:opacity-40 disabled:cursor-not-allowed
                             disabled:hover:border-slate-200 disabled:hover:bg-white
                             disabled:hover:text-slate-600 disabled:hover:shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            {/* Avatar */}
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center
                         rounded-full text-xs font-semibold ${
                           msg.role === "user"
                             ? "bg-slate-800 text-white"
                             : "bg-gradient-to-br from-violet-500 to-indigo-500 text-white"
                         }`}
            >
              {msg.role === "user" ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-slate-800 text-white rounded-br-md"
                  : "bg-slate-100 text-slate-800 rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <AssistantContent
                  content={msg.content}
                  isLast={idx === messages.length - 1}
                  isStreaming={isStreaming}
                />
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Streaming indicator when assistant message is empty */}
        {isStreaming &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "assistant" &&
          !messages[messages.length - 1].content && (
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center
                           rounded-full bg-gradient-to-br from-violet-500
                           to-indigo-500 text-white"
              >
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                <span className="text-sm text-slate-500">Analyzing…</span>
              </div>
            </div>
          )}

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-2 rounded-xl border
                       border-red-200 bg-red-50 px-4 py-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 bg-white px-6 py-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              summary
                ? "Ask about your production data…"
                : "Loading data — please wait…"
            }
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200
                       bg-slate-50 px-4 py-3 text-sm text-slate-800
                       placeholder-slate-400 outline-none transition-colors
                       focus:border-violet-400 focus:bg-white focus:ring-2
                       focus:ring-violet-100"
            style={{ maxHeight: "120px" }}
            disabled={isStreaming || !summary}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="flex h-11 w-11 shrink-0 items-center justify-center
                         rounded-xl bg-red-500 text-white transition-colors
                         hover:bg-red-600"
              title="Stop generating"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !summary}
              className="flex h-11 w-11 shrink-0 items-center justify-center
                         rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600
                         text-white transition-all duration-200
                         hover:shadow-lg hover:shadow-violet-500/25
                         disabled:opacity-40 disabled:cursor-not-allowed
                         disabled:hover:shadow-none"
              title="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Assistant message renderer ──────────────────────────────────────

function AssistantContent({
  content,
  isLast,
  isStreaming,
}: {
  content: string;
  isLast: boolean;
  isStreaming: boolean;
}) {
  if (!content) return null;

  return (
    <div className="space-y-2">
      {content.split("\n").map((line, i) => {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith("**") && trimmedLine.endsWith("**")) {
          return (
            <p key={i} className="font-semibold text-slate-900">
              {trimmedLine.slice(2, -2)}
            </p>
          );
        }

        if (
          trimmedLine.startsWith("- ") ||
          trimmedLine.startsWith("• ") ||
          /^\d+\.\s/.test(trimmedLine)
        ) {
          const bulletContent = trimmedLine.replace(/^[-•]\s|^\d+\.\s/, "");
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-violet-500 mt-0.5 shrink-0">•</span>
              <span>
                <InlineBold text={bulletContent} />
              </span>
            </div>
          );
        }

        if (!trimmedLine) return <div key={i} className="h-1" />;

        return (
          <p key={i} className="whitespace-pre-wrap">
            <InlineBold text={line} />
          </p>
        );
      })}
      {isLast && isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse rounded-full ml-0.5 align-text-bottom" />
      )}
    </div>
  );
}

function InlineBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
