/**
 * Phase 5.1: Coach Mode response schema (Zod).
 * Phase 5.3: Citations (sources) on TopAction.
 */
import { z } from "zod";

const CoachSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("score_snapshot"), id: z.string(), createdAt: z.string() }),
  z.object({ kind: z.literal("risk_flag"), id: z.string(), ruleKey: z.string() }),
  z.object({ kind: z.literal("next_action"), id: z.string(), ruleKey: z.string(), dedupeKey: z.string() }),
  z.object({ kind: z.literal("api"), route: z.string(), at: z.string() }),
]);

export const CTASchema = z.object({
  label: z.string(),
  actionKey: z.string(),
  modeDefault: z.enum(["preview", "execute"]).default("preview"),
  requiresConfirm: z.boolean().default(true),
  payload: z
    .object({
      nextActionId: z.string().optional(),
      nbaActionKey: z.string().optional(),
    })
    .optional(),
});

export const TopActionSchema = z.object({
  title: z.string(),
  actionKey: z.string(),
  nextActionId: z.string().optional(),
  why: z.string(),
  evidence: z.array(z.string()),
  sources: z.array(CoachSourceSchema).optional(),
  cta: CTASchema.optional(),
});

export const CoachReplySchema = z.object({
  status: z.string(),
  diagnosis: z.string(),
  topActions: z.array(TopActionSchema).max(3),
  risksOrUnknowns: z.array(z.string()),
  suggestedCommands: z.array(z.string()),
});

export const CoachSourcesSchema = z.object({
  score: z.object({
    latest: z.string(),
    recentEvents: z.array(z.unknown()),
  }),
  risk: z.object({
    summary: z.string(),
    top: z.array(z.unknown()),
  }),
  nba: z.object({
    summary: z.string(),
    top: z.array(z.unknown()),
  }),
});

export const CoachResponseSchema = z.object({
  reply: CoachReplySchema,
  sources: CoachSourcesSchema,
});

export type CoachReply = z.infer<typeof CoachReplySchema>;
export type CoachResponse = z.infer<typeof CoachResponseSchema>;
export type TopAction = z.infer<typeof TopActionSchema>;
