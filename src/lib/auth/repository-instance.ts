import { createAuthRepository, type AuthRepository } from "./repository";

let repository: AuthRepository | null = null;

function defaultDatabasePath(): string {
  return (
    process.env.USER_DB_PATH ??
    (process.env.NODE_ENV === "production"
      ? "/var/lib/offerlens/users.sqlite"
      : ".data/users.sqlite")
  );
}

export function getAuthRepository(): AuthRepository {
  repository ??= createAuthRepository({ path: defaultDatabasePath() });
  return repository;
}

