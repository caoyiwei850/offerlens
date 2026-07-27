import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

export const passwordSchema = z.string().min(8).max(128);

export const registerRequestSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginRequestSchema = registerRequestSchema;

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  email: string;
}

export type AuthErrorCode =
  | "INVALID_INPUT"
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "AUTH_UNAVAILABLE";

