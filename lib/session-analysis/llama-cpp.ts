import "server-only";

import type { SessionAnalysisEngineConfig } from "@/lib/env/session-analysis-engines";
import { SessionAnalysisEngineError } from "@/lib/errors/session-analysis-errors";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
  renderQwenChatPrompt,
} from "@/lib/session-analysis/analysis-prompt";
import { parseAnalysisEngineOutput } from "@/lib/session-analysis/analysis-output";
import { extractJsonObject } from "@/lib/session-analysis/json-extract";
import type { AnalysisEnginePort } from "@/lib/session-analysis/ports";
import {
  CommandTimedOutError,
  runCommand,
  type ProcessRunner,
} from "@/lib/session-analysis/process-runner";

export function createLlamaCppAnalysisEngine(input: {
  config: Pick<
    SessionAnalysisEngineConfig,
    | "llamaBin"
    | "llamaModelPath"
    | "llamaModelId"
    | "llamaTimeoutMs"
    | "llamaNCtx"
    | "llamaNGpuLayers"
    | "llamaNPredict"
    | "llamaTemperature"
  >;
  runner?: ProcessRunner;
}): AnalysisEnginePort {
  const runner = input.runner ?? runCommand;

  return {
    async analyze({ tracks, declaredStudentLevel }) {
      const prompt = renderQwenChatPrompt(
        ANALYSIS_SYSTEM_PROMPT,
        buildAnalysisUserPrompt({ tracks, declaredStudentLevel }),
      );

      let result;
      try {
        result = await runner({
          command: input.config.llamaBin,
          args: [
            "-m",
            input.config.llamaModelPath,
            "-c",
            String(input.config.llamaNCtx),
            "-ngl",
            String(input.config.llamaNGpuLayers),
            "-n",
            String(input.config.llamaNPredict),
            "--temp",
            String(input.config.llamaTemperature),
            "--simple-io",
            "-st",
            "--no-display-prompt",
            "-p",
            prompt,
          ],
          timeoutMs: input.config.llamaTimeoutMs,
        });
      } catch (error) {
        if (error instanceof CommandTimedOutError) {
          throw new SessionAnalysisEngineError("ANALYSIS_TIMEOUT");
        }
        throw new SessionAnalysisEngineError("ANALYSIS_ENGINE_UNAVAILABLE");
      }

      if (result.exitCode !== 0) {
        throw new SessionAnalysisEngineError("ANALYSIS_ENGINE_UNAVAILABLE");
      }

      try {
        return parseAnalysisEngineOutput(extractJsonObject(result.stdout));
      } catch {
        throw new SessionAnalysisEngineError("ANALYSIS_OUTPUT_INVALID");
      }
    },
  };
}
