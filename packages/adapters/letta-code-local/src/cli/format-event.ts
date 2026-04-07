import pc from "picocolors";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Pretty-print a single line of Letta Code stream-json output for terminal
 * display during `paperclipai run --watch`.
 */
export function printLettaCodeStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    console.log(line);
    return;
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";

  if (type === "system" && parsed.subtype === "init") {
    const model = typeof parsed.model === "string" ? parsed.model : "unknown";
    const agentId = typeof parsed.agent_id === "string" ? parsed.agent_id : "";
    const conversationId = typeof parsed.conversation_id === "string" ? parsed.conversation_id : "";
    const ids = [agentId && `agent: ${agentId}`, conversationId && `conv: ${conversationId}`]
      .filter(Boolean)
      .join(", ");
    console.log(pc.blue(`Letta Code initialized (model: ${model}${ids ? `, ${ids}` : ""})`));
    return;
  }

  if (type === "message") {
    const messageType = typeof parsed.message_type === "string" ? parsed.message_type : "";
    if (messageType === "assistant_message") {
      const content = typeof parsed.content === "string" ? parsed.content : "";
      if (content) console.log(pc.green(`assistant: ${content}`));
      return;
    }
    if (messageType === "reasoning_message") {
      const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";
      if (reasoning) console.log(pc.gray(`thinking: ${reasoning}`));
      return;
    }
    if (messageType === "tool_call_message") {
      const toolCall = asRecord(parsed.tool_call) ?? {};
      const name = typeof toolCall.name === "string" ? toolCall.name : "unknown";
      console.log(pc.yellow(`tool_call: ${name}`));
      const argumentsText = typeof toolCall.arguments === "string" ? toolCall.arguments : "";
      if (argumentsText) {
        const formatted = safeJsonParse(argumentsText);
        if (formatted) {
          console.log(pc.gray(JSON.stringify(formatted, null, 2)));
        } else {
          console.log(pc.gray(argumentsText));
        }
      }
      return;
    }
    if (messageType === "tool_return_message") {
      const status = typeof parsed.status === "string" ? parsed.status : "success";
      const toolReturn = typeof parsed.tool_return === "string" ? parsed.tool_return : "";
      const isError = status === "error";
      console.log((isError ? pc.red : pc.cyan)(`tool_result${isError ? " (error)" : ""}`));
      if (toolReturn) {
        console.log((isError ? pc.red : pc.gray)(toolReturn));
      }
      return;
    }
    return;
  }

  if (type === "result") {
    const usage = asRecord(parsed.usage) ?? {};
    const input = Number(usage.prompt_tokens ?? 0);
    const output = Number(usage.completion_tokens ?? 0);
    const cached = Number(usage.cached_input_tokens ?? 0);
    const subtype = typeof parsed.subtype === "string" ? parsed.subtype : "";
    const isError = subtype === "error";
    const stopReason = typeof parsed.stop_reason === "string" ? parsed.stop_reason : "";
    const resultText = typeof parsed.result === "string" ? parsed.result : "";
    if (resultText) {
      console.log(pc.green("result:"));
      console.log(resultText);
    }
    if (isError || subtype.startsWith("error")) {
      console.log(
        pc.red(`letta_code_result: subtype=${subtype || "unknown"}${stopReason ? ` stop_reason=${stopReason}` : ""}`),
      );
    }
    console.log(
      pc.blue(
        `tokens: in=${Number.isFinite(input) ? input : 0} out=${Number.isFinite(output) ? output : 0} cached=${Number.isFinite(cached) ? cached : 0}`,
      ),
    );
    return;
  }

  if (type === "error") {
    const message = typeof parsed.message === "string" ? parsed.message : line;
    console.error(pc.red(`letta_code_error: ${message}`));
    return;
  }

  if (debug) {
    console.log(pc.gray(line));
  }
}
