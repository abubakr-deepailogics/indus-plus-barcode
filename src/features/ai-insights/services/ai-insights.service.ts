import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ReportSummary } from "@/features/reports/types";
import type { ChatMessage } from "../types";

// Lazily initialised — the API key is only available at runtime (env var),
// not at import time during the build.
let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to your .env file.",
      );
    }
    _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
}

const MODEL_NAME = "gemini-3.6-flash";

const SYSTEM_PROMPT = `You are an expert factory production analyst for a garment manufacturing facility called "Indus Plus".
You answer questions about employee productivity, work orders, operations, sections, bundles, and coupon scanning data.

RULES:
1. Answer ONLY based on the data provided in the context below. Never invent numbers or statistics.
2. If the data doesn't contain enough information to answer, say so clearly.
3. Keep answers concise and actionable — floor supervisors need quick, clear answers.
4. Use bullet points and numbers for readability.
5. When mentioning monetary amounts, use PKR (Pakistani Rupees).
6. Respond in the SAME LANGUAGE the user asks in. If they ask in Urdu, respond in Urdu. If English, respond in English.
7. When comparing employees/operations/work orders, reference them by their codes/names from the data.
8. If asked for recommendations, ground them in the data (e.g. "Employee #X has the highest output at Y pieces, consider assigning them to…").
9. SAM = Standard Allowed Minutes (a measure of work content). SMV = Standard Minute Value (time allowed per piece). Rate = payment per piece in PKR.
10. "Coupons" represent scanned production bundles — each coupon = one bundle of garments processed through an operation by an employee.`;

/**
 * Strips the heavy `coupons[]` array from the summary to stay well under
 * token limits. The aggregated breakdowns (operations, workOrders, employees,
 * sections, bundles) carry the same analytical information in far fewer
 * tokens.
 */
function buildContextBlock(summary: ReportSummary): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- intentionally discarding coupons to save tokens
  const { coupons: _, ...condensed } = summary;
  return JSON.stringify(condensed, null, 2);
}

function buildHistoryMessages(
  history: Pick<ChatMessage, "role" | "content">[],
): { role: "user" | "model"; parts: { text: string }[] }[] {
  return history.map((msg) => ({
    role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: msg.content }],
  }));
}

/**
 * Streams a Gemini response for the given question + report context.
 * Returns a ReadableStream of UTF-8 text chunks (server-sent events format).
 */
export async function streamAiInsight(
  question: string,
  summary: ReportSummary,
  history: Pick<ChatMessage, "role" | "content">[] = [],
): Promise<ReadableStream<Uint8Array>> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_PROMPT,
  });

  const contextBlock = buildContextBlock(summary);

  const chatHistory = buildHistoryMessages(history);

  const chat = model.startChat({
    history: chatHistory.length > 0 ? chatHistory : undefined,
  });

  const userMessage = `Here is the current production report data:\n\n\`\`\`json\n${contextBlock}\n\`\`\`\n\nQuestion: ${question}`;

  const result = await chat.sendMessageStream(userMessage);

  // Convert the Gemini async iterable into a web ReadableStream that the
  // route handler can pipe straight to the response as SSE.
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            // SSE format: each data line followed by a blank line
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Stream error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: message })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });
}
