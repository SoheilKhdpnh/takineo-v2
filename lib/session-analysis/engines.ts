import "server-only";

import { getSessionAnalysisEngineConfig } from "@/lib/env/session-analysis-engines";
import { createLlamaCppAnalysisEngine } from "@/lib/session-analysis/llama-cpp";
import { createLocalFilesystemAudioStorage } from "@/lib/session-analysis/local-filesystem-audio";
import type { SessionAnalysisEngines } from "@/lib/session-analysis/ports";
import { createWhisperCppTranscriptionEngine } from "@/lib/session-analysis/whisper-cpp";

export function createSessionAnalysisEngines(): SessionAnalysisEngines {
  const config = getSessionAnalysisEngineConfig();
  return {
    transcription: createWhisperCppTranscriptionEngine({ config }),
    analysis: createLlamaCppAnalysisEngine({ config }),
    storage: createLocalFilesystemAudioStorage({ root: config.audioRoot }),
  };
}
