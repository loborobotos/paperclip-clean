import type { UIAdapterModule } from "../types";
import { parseLettaCodeStdoutLine } from "@paperclipai/adapter-letta-code-local/ui";
import { buildLettaCodeLocalConfig } from "@paperclipai/adapter-letta-code-local/ui";
import { LettaCodeLocalConfigFields } from "./config-fields";

export const lettaCodeLocalUIAdapter: UIAdapterModule = {
  type: "letta_code_local",
  label: "Letta Code (local)",
  parseStdoutLine: parseLettaCodeStdoutLine,
  ConfigFields: LettaCodeLocalConfigFields,
  buildAdapterConfig: buildLettaCodeLocalConfig,
};
