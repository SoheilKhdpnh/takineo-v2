import "server-only";

import { z } from "zod";

const nonEmptyPath = z.string().trim().min(1);
const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().nonnegative();
const unitInterval = z.coerce.number().gte(0).lte(1);

function readRequired<T>(name: string, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(process.env[name]);
  if (!parsed.success) {
    throw new Error(`Session analysis engine ${name} is not configured.`);
  }
  return parsed.data;
}

export type SessionAnalysisEngineConfig = {
  audioRoot: string;
  whisperBin: string;
  whisperModelPath: string;
  whisperModelId: string;
  whisperTimeoutMs: number;
  llamaBin: string;
  llamaModelPath: string;
  llamaModelId: string;
  llamaTimeoutMs: number;
  llamaNCtx: number;
  llamaNGpuLayers: number;
  llamaNPredict: number;
  llamaTemperature: number;
};

export function getSessionAnalysisEngineConfig(): SessionAnalysisEngineConfig {
  return {
    audioRoot: readRequired("SESSION_ANALYSIS_AUDIO_ROOT", nonEmptyPath),
    whisperBin: readRequired("SESSION_ANALYSIS_WHISPER_BIN", nonEmptyPath),
    whisperModelPath: readRequired("SESSION_ANALYSIS_WHISPER_MODEL_PATH", nonEmptyPath),
    whisperModelId: readRequired("SESSION_ANALYSIS_WHISPER_MODEL_ID", nonEmptyPath),
    whisperTimeoutMs: readRequired("SESSION_ANALYSIS_WHISPER_TIMEOUT_MS", positiveInt),
    llamaBin: readRequired("SESSION_ANALYSIS_LLAMA_BIN", nonEmptyPath),
    llamaModelPath: readRequired("SESSION_ANALYSIS_LLAMA_MODEL_PATH", nonEmptyPath),
    llamaModelId: readRequired("SESSION_ANALYSIS_LLAMA_MODEL_ID", nonEmptyPath),
    llamaTimeoutMs: readRequired("SESSION_ANALYSIS_LLAMA_TIMEOUT_MS", positiveInt),
    llamaNCtx: readRequired("SESSION_ANALYSIS_LLAMA_N_CTX", positiveInt),
    llamaNGpuLayers: readRequired(
      "SESSION_ANALYSIS_LLAMA_N_GPU_LAYERS",
      nonNegativeInt,
    ),
    llamaNPredict: readRequired("SESSION_ANALYSIS_LLAMA_N_PREDICT", positiveInt),
    llamaTemperature: readRequired(
      "SESSION_ANALYSIS_LLAMA_TEMPERATURE",
      unitInterval,
    ),
  };
}
