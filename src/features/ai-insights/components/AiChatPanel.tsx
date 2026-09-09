"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  Sparkles,
  X,
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

interface AiChatPanelProps {
  /** Current report data — null means "no report loaded yet". */
  summary: ReportSummary | null;
}

const QUICK_SUGGESTIONS = [
  "Who earned the most?",
  "Slowest operation?",
  "Summarize this report",
  "Compare top 3 employees",
  "خلاصہ بتائیں",
];

/**
 * Floating chat panel that slides in from the right edge of the viewport.
 * Only visible when a ReportSummary is loaded.
 */
export function AiChatPanel({ summary }: AiChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
  } = useAiChat();

  // Auto-scroll to bottom when new messages arrive or content streams in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || !summary || isStreaming) return;
      sendMessage(input.trim(), summary);
      setInput("");
    },
    [input, summary, isStreaming, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleQuickSuggestion = useCallback(
    (q: string) => {
      if (!summary || isStreaming) return;
      sendMessage(q, summary);
    },
    [summary, isStreaming, sendMessage],
  );

  // Don't render FAB if no data is loaded
  if (!summary) return null;

  return (
    <>
      {/* ── FAB Trigger ─────────────────────────────────────────── */}
      {!isOpen && (
        <button
          id="ai-chat-fab"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2
                     rounded-full bg-gradient-to-r from-violet-600 to-indigo-600
                     px-5 py-3.5 text-white shadow-lg shadow-violet-500/25
                     transition-all duration-300 ease-out
                     hover:scale-105 hover:shadow-xl hover:shadow-violet-500/30
                     active:scale-95 print:hidden"
          aria-label="Open AI Chat"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-semibold">Ask AI</span>
        </button>
      )}

      {/* ── Backdrop ────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm
                     transition-opacity duration-300 print:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Chat Panel ──────────────────────────────────────────── */}
      <div
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col
                    bg-white shadow-2xl transition-transform duration-300 ease-out
                    print:hidden
                    ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b
                     border-slate-200 bg-gradient-to-r from-violet-600
                     to-indigo-600 px-4 py-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
              <Bot className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                AI Production Analyst
              </h2>
              <p className="text-[11px] text-violet-200">
                Powered by Gemini 2.5 Flash
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="rounded-lg p-2 text-white/70 transition-colors
                           hover:bg-white/10 hover:text-white"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-2 text-white/70 transition-colors
                         hover:bg-white/10 hover:text-white"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center
                           rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100"
              >
                <MessageCircle className="h-8 w-8 text-violet-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">
                Ask anything about your report
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-[280px]">
                I can analyze employee productivity, compare operations,
                identify bottlenecks, and more.
              </p>

              {/* Quick suggestions */}
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleQuickSuggestion(q)}
                    className="rounded-full border border-slate-200 bg-white
                               px-3.5 py-1.5 text-xs font-medium text-slate-600
                               shadow-sm transition-all duration-200
                               hover:border-violet-300 hover:bg-violet-50
                               hover:text-violet-700 hover:shadow-md"
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
              className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center
                           rounded-full text-xs font-semibold ${
                             msg.role === "user"
                               ? "bg-slate-800 text-white"
                               : "bg-gradient-to-br from-violet-500 to-indigo-500 text-white"
                           }`}
              >
                {msg.role === "user" ? (
                  <User className="h-3.5 w-3.5" />
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
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

          {/* Streaming indicator */}
          {isStreaming &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "assistant" &&
            !messages[messages.length - 1].content && (
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center
                             rounded-full bg-gradient-to-br from-violet-500
                             to-indigo-500 text-white"
                >
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                  <span className="text-xs text-slate-500">Analyzing…</span>
                </div>
              </div>
            )}

          {/* Error banner */}
          {error && (
            <div
              className="flex items-start gap-2 rounded-xl border
                         border-red-200 bg-red-50 px-3.5 py-2.5"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your report data…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200
                         bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800
                         placeholder-slate-400 outline-none transition-colors
                         focus:border-violet-400 focus:bg-white focus:ring-2
                         focus:ring-violet-100"
              style={{ maxHeight: "120px" }}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="flex h-10 w-10 shrink-0 items-center justify-center
                           rounded-xl bg-red-500 text-white transition-colors
                           hover:bg-red-600"
                title="Stop generating"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center
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
    </>
  );
}

// ─── Assistant message renderer ──────────────────────────────────────

/** Lightweight markdown-ish rendering for the assistant's response. */
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

        // Bold headings (lines starting with **)
        if (trimmedLine.startsWith("**") && trimmedLine.endsWith("**")) {
          return (
            <p key={i} className="font-semibold text-slate-900">
              {trimmedLine.slice(2, -2)}
            </p>
          );
        }

        // Bullet points
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

        // Empty line → spacer
        if (!trimmedLine) {
          return <div key={i} className="h-1" />;
        }

        // Regular paragraph
        return (
          <p key={i} className="whitespace-pre-wrap">
            <InlineBold text={line} />
          </p>
        );
      })}
      {/* Blinking cursor while streaming */}
      {isLast && isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse rounded-full ml-0.5 align-text-bottom" />
      )}
    </div>
  );
}

/** Renders **bold** segments within a line. */
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
