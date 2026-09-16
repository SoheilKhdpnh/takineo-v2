import { afterEach, describe, expect, it } from "vitest";

import { getSessionAnalysisEngineConfig } from "@/lib/env/session-analysis-engines";

const KEYS = [
  "SESSION_ANALYSIS_AUDIO_ROOT",
  "SESSION_ANALYSIS_WHISPER_BIN",
  "SESSION_ANALYSIS_WHISPER_MODEL_PATH",
  "SESSION_ANALYSIS_WHISPER_MODEL_ID",
  "SESSION_ANALYSIS_WHISPER_TIMEOUT_MS",
  "SESSION_ANALYSIS_LLAMA_BIN",
  "SESSION_ANALYSIS_LLAMA_MODEL_PATH",
  "SESSION_ANALYSIS_LLAMA_MODEL_ID",
  "SESSION_ANALYSIS_LLAMA_TIMEOUT_MS",
  "SESSION_ANALYSIS_LLAMA_N_CTX",
  "SESSION_ANALYSIS_LLAMA_N_GPU_LAYERS",
  "SESSION_ANALYSIS_LLAMA_N_PREDICT",
  "SESSION_ANALYSIS_LLAMA_TEMPERATURE",
] as const;

const valid: Record<(typeof KEYS)[number], string> = {
  SESSION_ANALYSIS_AUDIO_ROOT: "/var/lib/takineo/audio",
  SESSION_ANALYSIS_WHISPER_BIN: "/usr/local/bin/whisper-cli",
  SESSION_ANALYSIS_WHISPER_MODEL_PATH:
    "/var/lib/takineo/models/transcription/ggml-large-v3-turbo.bin",
  SESSION_ANALYSIS_WHISPER_MODEL_ID: "large-v3-turbo",
  SESSION_ANALYSIS_WHISPER_TIMEOUT_MS: "600000",
  SESSION_ANALYSIS_LLAMA_BIN: "/usr/local/bin/llama-cli",
  SESSION_ANALYSIS_LLAMA_MODEL_PATH:
    "/var/lib/takineo/models/analysis/qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf",
  SESSION_ANALYSIS_LLAMA_MODEL_ID: "Qwen2.5-7B-Instruct-Q4_K_M",
  SESSION_ANALYSIS_LLAMA_TIMEOUT_MS: "600000",
  SESSION_ANALYSIS_LLAMA_N_CTX: "4096",
  SESSION_ANALYSIS_LLAMA_N_GPU_LAYERS: "0",
  SESSION_ANALYSIS_LLAMA_N_PREDICT: "900",
  SESSION_ANALYSIS_LLAMA_TEMPERATURE: "0.1",
};

describe("session analysis engine config", () => {
  afterEach(() => {
    for (const key of KEYS) {
      delete process.env[key];
    }
  });

  it("reads a fully configured engine runtime", () => {
    Object.assign(process.env, valid);
    expect(getSessionAnalysisEngineConfig()).toMatchObject({
      whisperModelId: "large-v3-turbo",
      llamaNGpuLayers: 0,
      llamaNCtx: 4096,
      llamaTemperature: 0.1,
    });
  });

  it.each(KEYS)("fails closed when %s is absent", (key) => {
    Object.assign(process.env, valid);
    delete process.env[key];
    expect(() => getSessionAnalysisEngineConfig()).toThrow(/is not configured/);
  });
});
