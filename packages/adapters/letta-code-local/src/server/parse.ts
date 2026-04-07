import type { UsageSummary } from "@paperclipai/adapter-utils";
import { asString, asNumber, parseObject, parseJson } from "@paperclipai/adapter-utils/server-utils";

const LETTA_AUTH_REQUIRED_RE =
  /(?:not\s+logged\s+in|please\s+log\s+in|please\s+run\s+`?letta\s+(?:login|--connect)`?|login\s+required|requires\s+login|unauthorized|authentication\s+required|api[_\s-]?key.*(?:missing|invalid|required))/i;

/**
 * Parse Letta Code's stream-json (NDJSON) output.
 *
 * Letta Code emits one JSON object per line. Key event types (from
 * `@letta-ai/letta-code/dist/types/protocol.d.ts`):
 * - `system` (subtype: "init") — agent_id, conversation_id, model, tools, cwd
 * - `message` — assistant text (message_type === "assistant_message"), tool calls, reasoning
 * - `result` — final: subtype, agent_id, conversation_id, duration_ms, num_turns, usage, stop_reason
 * - `error` — failure with stop_reason
 * - `retry` — transient retry
 */
export function parseLettaCodeStreamJson(stdout: string) {
  let agentId: string | null = null;
  let conversationId: string | null = null;
  let model = "";
  let finalResult: Record<string, unknown> | null = null;
  const assistantTexts: string[] = [];

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const event = parseJson(line);
    if (!event) continue;

    const type = asString(event.type, "");

    if (type === "system" && asString(event.subtype, "") === "init") {
      agentId = asString(event.agent_id, agentId ?? "") || agentId;
      conversationId = asString(event.conversation_id, conversationId ?? "") || conversationId;
      model = asString(event.model, model);
      continue;
    }

    if (type === "message") {
      agentId = asString(event.agent_id, agentId ?? "") || agentId;
      conversationId = asString(event.conversation_id, conversationId ?? "") || conversationId;
      const messageType = asString(event.message_type, "");
      if (messageType === "assistant_message") {
        const content = asString(event.content, "");
        if (content) assistantTexts.push(content);
      }
      continue;
    }

    if (type === "result") {
      finalResult = event;
      agentId = asString(event.agent_id, agentId ?? "") || agentId;
      conversationId = asString(event.conversation_id, conversationId ?? "") || conversationId;
    }
  }

  if (!finalResult) {
    return {
      agentId,
      conversationId,
      model,
      costUsd: null as number | null,
      usage: null as UsageSummary | null,
      summary: assistantTexts.join("\n\n").trim(),
      resultJson: null as Record<string, unknown> | null,
    };
  }

  const usageObj = parseObject(finalResult.usage);
  const usage: UsageSummary = {
    inputTokens: asNumber(usageObj.prompt_tokens, 0),
    cachedInputTokens: asNumber(usageObj.cached_input_tokens, 0),
    outputTokens: asNumber(usageObj.completion_tokens, 0),
  };
  const summary = asString(finalResult.result, assistantTexts.join("\n\n")).trim();

  return {
    agentId,
    conversationId,
    model,
    costUsd: null as number | null,
    usage,
    summary,
    resultJson: finalResult,
  };
}

export function describeLettaCodeFailure(parsed: Record<string, unknown>): string | null {
  const subtype = asString(parsed.subtype, "");
  const stopReason = asString(parsed.stop_reason, "");
  const resultText = asString(parsed.result, "").trim();

  const parts = ["Letta Code run failed"];
  if (subtype) parts.push(`subtype=${subtype}`);
  if (stopReason) parts.push(`stop_reason=${stopReason}`);
  if (resultText) parts.push(resultText);
  return parts.length > 1 ? parts.join(": ") : null;
}

export function isLettaCodeMaxTurnsResult(parsed: Record<string, unknown> | null | undefined): boolean {
  if (!parsed) return false;

  const stopReason = asString(parsed.stop_reason, "").trim().toLowerCase();
  if (stopReason === "max_steps" || stopReason === "max_turns") return true;

  const resultText = asString(parsed.result, "").trim();
  return /max(?:imum)?\s+(?:steps|turns)/i.test(resultText);
}

export function isLettaCodeUnknownAgentError(parsed: Record<string, unknown>): boolean {
  const resultText = asString(parsed.result, "").trim();
  if (
    /agent.*(not found|does not exist|unknown|invalid)/i.test(resultText) ||
    /conversation.*(not found|does not exist|unknown|invalid)/i.test(resultText)
  ) {
    return true;
  }
  return false;
}

export function detectLettaCodeAuthRequired(input: {
  parsed: Record<string, unknown> | null;
  stdout: string;
  stderr: string;
}): { requiresAuth: boolean } {
  const resultText = asString(input.parsed?.result, "").trim();
  const messages = [resultText, input.stdout, input.stderr]
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return { requiresAuth: messages.some((line) => LETTA_AUTH_REQUIRED_RE.test(line)) };
}
