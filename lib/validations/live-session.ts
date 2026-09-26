import { z } from "zod";

const liveSessionIdentifierSchema = z
  .string()
  .min(1)
  .max(128)
  .refine(
    (value) => value === value.trim() && !/\s/.test(value),
    {
      message: "Identifier must not contain whitespace.",
    },
  );

const liveSessionReferenceSchema = z
  .string()
  .min(1)
  .max(256)
  .refine(
    (value) => value === value.trim() && !/\s/.test(value),
    {
      message: "Reference must not contain whitespace.",
    },
  );

const clientJoinAttemptIdSchema = z
  .string()
  .min(1)
  .max(128)
  .refine(
    (value) => value === value.trim() && !/\s/.test(value),
    {
      message: "Join attempt id must not contain whitespace.",
    },
  );

export const issueLiveSessionJoinSchema = z
  .object({
    sessionId: liveSessionIdentifierSchema,
    clientJoinAttemptId: clientJoinAttemptIdSchema,
  })
  .strict();

export const issueLiveSessionJoinBodySchema = issueLiveSessionJoinSchema
  .omit({
    sessionId: true,
  })
  .strict();

export const liveSessionReadIdSchema = liveSessionIdentifierSchema;

const occurredAtSchema = z
  .string()
  .min(1)
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    {
      message: "occurredAt must be an ISO-8601 timestamp.",
    },
  )
  .transform(
    (value) => new Date(value),
  );

const participantEventSchema = z
  .object({
    providerEventRef: liveSessionReferenceSchema,
    sessionId: liveSessionIdentifierSchema,
    type: z.enum([
      "PARTICIPANT_CONNECTED",
      "PARTICIPANT_DISCONNECTED",
    ]),
    occurredAt: occurredAtSchema,
    providerParticipantRef: liveSessionReferenceSchema,
    connectionRef: liveSessionReferenceSchema,
  })
  .strict();

const roomEndedEventSchema = z
  .object({
    providerEventRef: liveSessionReferenceSchema,
    sessionId: liveSessionIdentifierSchema,
    type: z.literal("ROOM_ENDED"),
    occurredAt: occurredAtSchema,
  })
  .strict();

export const liveSessionProviderWebhookEventSchema = z.union([
  participantEventSchema,
  roomEndedEventSchema,
]);

export const liveSessionCompletionJobSchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(20),
    sessionId: liveSessionIdentifierSchema.optional(),
  })
  .strict();

export type IssueLiveSessionJoinInput = z.infer<
  typeof issueLiveSessionJoinSchema
>;

export type LiveSessionProviderWebhookEventInput = z.infer<
  typeof liveSessionProviderWebhookEventSchema
>;

export type LiveSessionCompletionJobInput = z.infer<
  typeof liveSessionCompletionJobSchema
>;
