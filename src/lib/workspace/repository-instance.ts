import { createWorkspaceRepository, type WorkspaceRepository } from "./repository";

let repository: WorkspaceRepository | null = null;

function defaultDatabasePath(): string {
  return (
    process.env.USER_DB_PATH ??
    (process.env.NODE_ENV === "production"
      ? "/var/lib/offerlens/users.sqlite"
      : ".data/users.sqlite")
  );
}

export function getWorkspaceRepository(): WorkspaceRepository {
  repository ??= createWorkspaceRepository({ path: defaultDatabasePath() });
  return repository;
}

