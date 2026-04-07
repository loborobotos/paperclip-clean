import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  asStringArray,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import path from "node:path";
import { detectLettaCodeAuthRequired, parseLettaCodeStreamJson } from "./parse.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function commandLooksLike(command: string, expected: string): boolean {
  const base = path.basename(command).toLowerCase();
  return base === expected || base === `${expected}.cmd` || base === `${expected}.exe`;
}

function summarizeProbeDetail(stdout: string, stderr: string): string | null {
  const raw = firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "letta");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "letta_code_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "letta_code_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  try {
    await ensureCommandResolvable(command, cwd, runtimeEnv);
    checks.push({
      code: "letta_code_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "letta_code_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command,
      hint: "Install Letta Code: npm install -g @letta-ai/letta-code",
    });
  }

  const canRunProbe =
    checks.every(
      (check) => check.code !== "letta_code_cwd_invalid" && check.code !== "letta_code_command_unresolvable",
    );
  if (canRunProbe) {
    if (!commandLooksLike(command, "letta")) {
      checks.push({
        code: "letta_code_hello_probe_skipped_custom_command",
        level: "info",
        message: "Skipped hello probe because command is not `letta`.",
        detail: command,
        hint: "Use the `letta` CLI command to run the automatic probe.",
      });
    } else {
      const model = asString(config.model, "").trim();
      const maxTurns = asNumber(config.maxTurnsPerRun, 1);
      const permissionMode = asString(config.permissionMode, "bypassPermissions");
      const extraArgs = (() => {
        const fromExtraArgs = asStringArray(config.extraArgs);
        if (fromExtraArgs.length > 0) return fromExtraArgs;
        return asStringArray(config.args);
      })();

      const args = [
        "--prompt",
        "--output-format",
        "stream-json",
        "--permission-mode",
        permissionMode,
        "--memfs-startup",
        "skip",
      ];
      if (model) args.push("--model", model);
      if (maxTurns > 0) args.push("--max-turns", String(maxTurns));
      if (extraArgs.length > 0) args.push(...extraArgs);

      const probe = await runChildProcess(
        `letta-code-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        args,
        {
          cwd,
          env,
          timeoutSec: 45,
          graceSec: 5,
          stdin: "Respond with hello.",
          onLog: async () => {},
        },
      );

      const parsedStream = parseLettaCodeStreamJson(probe.stdout);
      const authMeta = detectLettaCodeAuthRequired({
        parsed: parsedStream.resultJson,
        stdout: probe.stdout,
        stderr: probe.stderr,
      });
      const detail = summarizeProbeDetail(probe.stdout, probe.stderr);

      if (probe.timedOut) {
        checks.push({
          code: "letta_code_hello_probe_timed_out",
          level: "warn",
          message: "Letta Code hello probe timed out.",
          hint: "Retry the probe. If this persists, verify Letta Code can run from this directory manually.",
        });
      } else if (authMeta.requiresAuth) {
        checks.push({
          code: "letta_code_hello_probe_auth_required",
          level: "warn",
          message: "Letta Code CLI is installed, but authentication is required.",
          ...(detail ? { detail } : {}),
          hint: "Run `letta` interactively once to authenticate, or set LETTA_API_KEY in env bindings.",
        });
      } else if ((probe.exitCode ?? 1) === 0) {
        const summary = parsedStream.summary.trim();
        const hasHello = /\bhello\b/i.test(summary);
        checks.push({
          code: hasHello ? "letta_code_hello_probe_passed" : "letta_code_hello_probe_unexpected_output",
          level: hasHello ? "info" : "warn",
          message: hasHello
            ? "Letta Code hello probe succeeded."
            : "Letta Code probe ran but did not return `hello` as expected.",
          ...(summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {}),
          ...(hasHello
            ? {}
            : {
                hint: "Try the probe manually: `letta --prompt --output-format stream-json --max-turns 1` and prompt `Respond with hello`.",
              }),
        });
      } else {
        checks.push({
          code: "letta_code_hello_probe_failed",
          level: "error",
          message: "Letta Code hello probe failed.",
          ...(detail ? { detail } : {}),
          hint: "Run `letta --prompt --output-format stream-json --max-turns 1` manually in this directory and prompt `Respond with hello` to debug.",
        });
      }
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
