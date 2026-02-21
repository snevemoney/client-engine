import { z } from "zod";

export const PositioningMetaSchema = z.object({
  feltProblem: z.string().min(10),
  languageMap: z.object({
    use: z.array(z.string()).min(1),
    avoid: z.array(z.string()).optional().default([]),
    competitorOveruse: z.array(z.string()).optional().default([]),
  }),
  reframedOffer: z.string().min(10),
  blueOceanAngle: z.string().min(10),
  packaging: z.object({
    solutionName: z.string().min(2),
    doNotMention: z.array(z.string()).optional().default([]),
    hookOneLiner: z.string().min(10),
  }),
});

export type PositioningMeta = z.infer<typeof PositioningMetaSchema>;
