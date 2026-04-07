export const type = "letta_code_local";
export const label = "Letta Code (local)";

export const models = [
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { id: "anthropic/claude-opus-4-5", label: "Claude Opus 4.5" },
  { id: "openai/gpt-4.1", label: "GPT 4.1" },
  { id: "openai/o3", label: "o3" },
  { id: "google/gemini-3-pro", label: "Gemini 3 Pro" },
];

export const agentConfigurationDoc = `# letta_code_local agent configuration

Adapter: letta_code_local

Spawns the Letta Code CLI (\`letta\`) as a local child process. Letta Code is a memory-first
coding agent with persistent state across sessions — agents learn and improve over time.

Use when:
- You want Paperclip to run the Letta Code CLI locally as the agent runtime
- You want persistent agent memory across runs (Letta agents retain state automatically)
- You want model-agnostic agents (Claude, GPT, Gemini, GLM) routed through Letta

Don't use when:
- The Letta Code CLI is not installed on the machine (npm install -g @letta-ai/letta-code)
- You only need a one-shot script execution (use the "process" adapter instead)
- You need stateless agents (use claude_local or codex_local instead)

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- model (string, optional): Letta model handle (e.g. "anthropic/claude-sonnet-4-5")
- promptTemplate (string, optional): run prompt template
- bootstrapPromptTemplate (string, optional): template used only for fresh sessions (no existing agent)
- maxTurnsPerRun (number, optional): max turns for one run, default 25
- permissionMode (string, optional): tool permission mode passed via --permission-mode (default|acceptEdits|bypassPermissions|plan); default is bypassPermissions for headless runs
- memfsStartup (string, optional): memory filesystem startup mode (blocking|background|skip); default is background
- command (string, optional): defaults to "letta"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds, default 0 (unlimited)
- graceSec (number, optional): SIGTERM grace period in seconds, default 20

Notes:
- Runs are executed with: letta --prompt --output-format stream-json ...
- Prompts are piped to the CLI via stdin.
- Sessions resume by passing --agent <id> --conversation <id> when stored session cwd matches current cwd.
- Skills are mounted ephemerally per-run via --skills <tmpdir> (cleaned up after each run).
- Authentication is delegated to the local \`letta\` CLI (run \`letta\` interactively once to log in,
  or set LETTA_API_KEY in env bindings for headless deployments).
- For self-hosted Letta servers, set LETTA_BASE_URL in env bindings; the CLI reads it natively.
`;
