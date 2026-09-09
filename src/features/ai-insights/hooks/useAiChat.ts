"use client";

import { useCallback, useRef, useState } from "react";
import type { ReportSummary } from "@/features/reports/types";
import type { ChatMessage } from "../types";

/**
 * Manages chat state and streaming communication with the AI insights API.
 *
 * `sendMessage` POSTs the question + current ReportSummary + recent history
 * to `/api/ai/insights`, then reads the SSE stream token-by-token and
 * appends to the assistant's message in real-time.
 */
export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (question: string, summary: ReportSummary) => {
      const trimmed = question.trim();
      if (!trimmed || isStreaming) return;

      // Append user message
      const userMsg: ChatMessage = {
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setError(null);

      // Build history from last 10 messages (excluding the one we just added,
      // which goes as the `question` field instead).
      const history = [...messages].slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const controller = new AbortController();
      abortRef.current = controller;

      // Placeholder assistant message that we'll stream into
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        const response = await fetch("/api/ai/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, summary, history }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            (errData as { error?: string }).error ||
              `Request failed (${response.status})`,
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream available.");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines from the buffer
          const lines = buffer.split("\n");
          // Keep the last (possibly incomplete) line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

            const payload = trimmedLine.slice(6); // strip "data: "
            if (payload === "[DONE]") continue;

            try {
              const parsed: string | { error: string } = JSON.parse(payload);
              if (typeof parsed === "string") {
                // Append token to the last (assistant) message
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + parsed,
                    };
                  }
                  return updated;
                });
              } else if (parsed && typeof parsed === "object" && "error" in parsed) {
                setError(parsed.error);
              }
            } catch {
              // Skip malformed SSE data lines
            }
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string }).name === "AbortError") {
          // User cancelled — not an error
          return;
        }
        const msg =
          err instanceof Error ? err.message : "Failed to get AI response.";
        setError(msg);
        // Remove the empty assistant placeholder on error
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
  };
}
