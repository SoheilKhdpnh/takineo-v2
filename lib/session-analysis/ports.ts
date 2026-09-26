import type {
  AnalysisEngineOutput,
  AudioParticipantRole,
  EngineTrackTranscript,
  EnglishLevel,
} from "@/lib/domain/session-analysis";

export type AudioObjectRef = {
  storageProvider: "LOCAL_FILESYSTEM" | "S3_COMPATIBLE";
  storageBucket: string;
  storageKey: string;
};

export type AudioStoragePort = {
  head(ref: AudioObjectRef): Promise<{ byteSize: number } | null>;
  openReadStream(ref: AudioObjectRef): Promise<ReadableStream<Uint8Array>>;
  delete(ref: AudioObjectRef): Promise<void>;
};

export type TranscriptionEnginePort = {
  transcribe(input: {
    contentSha256: string;
    participantRole: AudioParticipantRole;
    audio: Buffer;
  }): Promise<EngineTrackTranscript>;
};

export type AnalysisEnginePort = {
  analyze(input: {
    contentSha256: string;
    tracks: EngineTrackTranscript[];
    declaredStudentLevel: EnglishLevel | null;
  }): Promise<AnalysisEngineOutput>;
};

export type SessionAnalysisEngines = {
  transcription: TranscriptionEnginePort;
  analysis: AnalysisEnginePort;
  storage: AudioStoragePort;
};
