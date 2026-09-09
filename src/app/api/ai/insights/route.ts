import { streamAiInsight } from "@/features/ai-insights/services/ai-insights.service";
import type { AiInsightsRequest } from "@/features/ai-insights/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: AiInsightsRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { question, summary, history } = body;

  if (!question || typeof question !== "string" || !question.trim()) {
    return Response.json(
      { error: "A non-empty question is required." },
      { status: 400 },
    );
  }
  if (!summary || typeof summary !== "object") {
    return Response.json(
      { error: "A valid report summary is required." },
      { status: 400 },
    );
  }

  try {
    // Cap history to last 10 messages to avoid blowing context limits
    const trimmedHistory = Array.isArray(history)
      ? history.slice(-10)
      : [];

    const stream = await streamAiInsight(
      question.trim(),
      summary,
      trimmedHistory,
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    console.error("AI insights API error:", err);
    const msg =
      err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
