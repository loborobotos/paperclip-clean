import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Parse a single line of Letta Code stream-json (NDJSON) output into
 * Paperclip transcript entries for the run viewer.
 */
export function parseLettaCodeStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    return [{ kind: "stdout", ts, text: line }];
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";

  if (type === "system" && parsed.subtype === "init") {
    return [
      {
        kind: "init",
        ts,
        model: typeof parsed.model === "string" ? parsed.model : "unknown",
        sessionId: typeof parsed.agent_id === "string" ? parsed.agent_id : "",
      },
    ];
  }

  if (type === "message") {
    const messageType = typeof parsed.message_type === "string" ? parsed.message_type : "";
    if (messageType === "assistant_message") {
      const content = typeof parsed.content === "string" ? parsed.content : "";
      if (content) return [{ kind: "assistant", ts, text: content }];
    }
    if (messageType === "reasoning_message") {
      const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";
      if (reasoning) return [{ kind: "thinking", ts, text: reasoning }];
    }
    if (messageType === "tool_call_message") {
      const toolCall = asRecord(parsed.tool_call) ?? {};
      const name = typeof toolCall.name === "string" ? toolCall.name : "unknown";
      const toolCallId = typeof toolCall.tool_call_id === "string" ? toolCall.tool_call_id : undefined;
      let input: unknown = {};
      const argumentsText = typeof toolCall.arguments === "string" ? toolCall.arguments : "";
      if (argumentsText) {
        const maybe = safeJsonParse(argumentsText);
        input = maybe ?? argumentsText;
      }
      return [{ kind: "tool_call", ts, name, toolUseId: toolCallId, input }];
    }
    if (messageType === "tool_return_message") {
      const status = typeof parsed.status === "string" ? parsed.status : "success";
      const toolCallId = typeof parsed.tool_call_id === "string" ? parsed.tool_call_id : "";
      const toolReturn = typeof parsed.tool_return === "string" ? parsed.tool_return : "";
      return [
        {
          kind: "tool_result",
          ts,
          toolUseId: toolCallId,
          content: toolReturn,
          isError: status === "error",
        },
      ];
    }
    return [{ kind: "stdout", ts, text: line }];
  }

  if (type === "result") {
    const usage = asRecord(parsed.usage) ?? {};
    const inputTokens = asNumberOrZero(usage.prompt_tokens);
    const outputTokens = asNumberOrZero(usage.completion_tokens);
    const cachedTokens = asNumberOrZero(usage.cached_input_tokens);
    const subtype = typeof parsed.subtype === "string" ? parsed.subtype : "";
    const isError = subtype === "error";
    const text = typeof parsed.result === "string" ? parsed.result : "";
    return [
      {
        kind: "result",
        ts,
        text,
        inputTokens,
        outputTokens,
        cachedTokens,
        costUsd: 0,
        subtype,
        isError,
        errors: [],
      },
    ];
  }

  if (type === "error") {
    const message = typeof parsed.message === "string" ? parsed.message : line;
    return [{ kind: "stderr", ts, text: message }];
  }

  return [{ kind: "stdout", ts, text: line }];
}
