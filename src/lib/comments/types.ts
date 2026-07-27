import { z } from "zod";

export interface PublicComment {
  id: string;
  nickname: string;
  rating: number;
  content: string;
  createdAt: string;
}

export type ModerationDecision = "APPROVED" | "REJECTED";

export interface CommentSubmission {
  id: string;
  status: "PENDING";
}

export interface PendingComment extends PublicComment {
  status: "PENDING";
}

export interface CommentStats {
  total: number;
  averageRating: number | null;
}

export interface CommentPage {
  comments: PublicComment[];
  nextCursor: string | null;
  stats: CommentStats;
}

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const commentSubmissionSchema = z
  .object({
    nickname: z.string().trim().max(30).optional().default(""),
    rating: z.number().int().min(1).max(5),
    content: z.string().trim().min(2).max(300),
    deviceId: digestSchema,
    fingerprint: digestSchema,
  })
  .strict()
  .transform((value) => ({
    ...value,
    nickname: value.nickname || "匿名用户",
  }));

export const commentQuerySchema = z.object({
  cursor: z.string().trim().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(20),
});
