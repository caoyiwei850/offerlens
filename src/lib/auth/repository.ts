import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { AuthUser } from "./types";

export interface AuthRepository {
  createUser(input: { email: string; passwordHash: string }): AuthUser | null;
  findUserByEmail(email: string): (AuthUser & { passwordHash: string }) | null;
  findUserById(id: string): AuthUser | null;
  close(): void;
}

interface RepositoryOptions {
  path: string;
  createId?: () => string;
  now?: () => string;
}

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

function toUser(row: UserRow): AuthUser & { passwordHash: string } {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  };
}

export function createAuthRepository({
  path: databasePath,
  createId = randomUUID,
  now = () => new Date().toISOString(),
}: RepositoryOptions): AuthRepository {
  if (databasePath !== ":memory:") {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const insertUser = database.prepare(`
    INSERT INTO users (id, email, password_hash, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const findByEmail = database.prepare(`
    SELECT
      id,
      email,
      password_hash AS passwordHash,
      created_at AS createdAt
    FROM users
    WHERE email = ?
  `);
  const findById = database.prepare(`
    SELECT
      id,
      email,
      password_hash AS passwordHash,
      created_at AS createdAt
    FROM users
    WHERE id = ?
  `);

  return {
    createUser(input) {
      const user = {
        id: createId(),
        email: input.email,
        createdAt: now(),
      };
      try {
        insertUser.run(user.id, user.email, input.passwordHash, user.createdAt);
      } catch (error) {
        if (error instanceof Error && /UNIQUE/.test(error.message)) {
          return null;
        }
        throw error;
      }
      return user;
    },

    findUserByEmail(email) {
      const row = findByEmail.get(email) as UserRow | undefined;
      return row ? toUser(row) : null;
    },

    findUserById(id) {
      const row = findById.get(id) as UserRow | undefined;
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        createdAt: row.createdAt,
      };
    },

    close() {
      database.close();
    },
  };
}

