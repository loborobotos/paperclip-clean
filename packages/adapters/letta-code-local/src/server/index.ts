export { execute } from "./execute.js";
export { listLettaCodeSkills, syncLettaCodeSkills } from "./skills.js";
export { testEnvironment } from "./test.js";
export {
  parseLettaCodeStreamJson,
  describeLettaCodeFailure,
  isLettaCodeMaxTurnsResult,
  isLettaCodeUnknownAgentError,
  detectLettaCodeAuthRequired,
} from "./parse.js";
import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw: unknown) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const agentId = readNonEmptyString(record.agentId) ?? readNonEmptyString(record.agent_id);
    if (!agentId) return null;
    const conversationId =
      readNonEmptyString(record.conversationId) ?? readNonEmptyString(record.conversation_id);
    const cwd =
      readNonEmptyString(record.cwd) ??
      readNonEmptyString(record.workdir) ??
      readNonEmptyString(record.folder);
    const workspaceId = readNonEmptyString(record.workspaceId) ?? readNonEmptyString(record.workspace_id);
    const repoUrl = readNonEmptyString(record.repoUrl) ?? readNonEmptyString(record.repo_url);
    const repoRef = readNonEmptyString(record.repoRef) ?? readNonEmptyString(record.repo_ref);
    return {
      agentId,
      ...(conversationId ? { conversationId } : {}),
      ...(cwd ? { cwd } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(repoUrl ? { repoUrl } : {}),
      ...(repoRef ? { repoRef } : {}),
    };
  },
  serialize(params: Record<string, unknown> | null) {
    if (!params) return null;
    const agentId = readNonEmptyString(params.agentId) ?? readNonEmptyString(params.agent_id);
    if (!agentId) return null;
    const conversationId =
      readNonEmptyString(params.conversationId) ?? readNonEmptyString(params.conversation_id);
    const cwd =
      readNonEmptyString(params.cwd) ??
      readNonEmptyString(params.workdir) ??
      readNonEmptyString(params.folder);
    const workspaceId = readNonEmptyString(params.workspaceId) ?? readNonEmptyString(params.workspace_id);
    const repoUrl = readNonEmptyString(params.repoUrl) ?? readNonEmptyString(params.repo_url);
    const repoRef = readNonEmptyString(params.repoRef) ?? readNonEmptyString(params.repo_ref);
    return {
      agentId,
      ...(conversationId ? { conversationId } : {}),
      ...(cwd ? { cwd } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(repoUrl ? { repoUrl } : {}),
      ...(repoRef ? { repoRef } : {}),
    };
  },
  getDisplayId(params: Record<string, unknown> | null) {
    if (!params) return null;
    return (
      readNonEmptyString(params.conversationId) ??
      readNonEmptyString(params.conversation_id) ??
      readNonEmptyString(params.agentId) ??
      readNonEmptyString(params.agent_id)
    );
  },
};
