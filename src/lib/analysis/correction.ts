import { createHash, randomBytes } from "node:crypto";

export interface CorrectionIdentity {
  deviceId: string;
  fingerprint: string;
}

export interface OccupationCorrectionStore {
  saveToken(
    tokenHash: string,
    deviceHash: string,
    ttlSeconds: number,
  ): Promise<void>;
  claimToken(
    tokenHash: string,
    deviceHash: string,
    claimId: string,
    leaseSeconds: number,
  ): Promise<boolean>;
  completeToken(
    tokenHash: string,
    deviceHash: string,
    claimId: string,
  ): Promise<boolean>;
  releaseToken(
    tokenHash: string,
    deviceHash: string,
    claimId: string,
  ): Promise<void>;
}

export interface OccupationCorrection {
  token: string;
  expires_at: string;
}

const TOKEN_TTL_SECONDS = 2 * 60 * 60;
const CLAIM_LEASE_SECONDS = 60;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function tokenHash(token: string): string {
  return digest(`occupation-correction:${token}`);
}

function deviceHash(identity: CorrectionIdentity): string {
  return digest(`${identity.deviceId}:${identity.fingerprint}`);
}

export async function issueOccupationCorrection(
  identity: CorrectionIdentity,
  store: OccupationCorrectionStore,
  options: {
    now?: Date;
    randomToken?: () => string;
  } = {},
): Promise<OccupationCorrection> {
  const now = options.now ?? new Date();
  const token = options.randomToken?.() ?? randomBytes(32).toString("base64url");
  await store.saveToken(
    tokenHash(token),
    deviceHash(identity),
    TOKEN_TTL_SECONDS,
  );
  return {
    token,
    expires_at: new Date(
      now.getTime() + TOKEN_TTL_SECONDS * 1000,
    ).toISOString(),
  };
}

export function claimOccupationCorrection(
  token: string,
  claimId: string,
  identity: CorrectionIdentity,
  store: OccupationCorrectionStore,
): Promise<boolean> {
  return store.claimToken(
    tokenHash(token),
    deviceHash(identity),
    claimId,
    CLAIM_LEASE_SECONDS,
  );
}

export function completeOccupationCorrection(
  token: string,
  claimId: string,
  identity: CorrectionIdentity,
  store: OccupationCorrectionStore,
): Promise<boolean> {
  return store.completeToken(
    tokenHash(token),
    deviceHash(identity),
    claimId,
  );
}

export function releaseOccupationCorrection(
  token: string,
  claimId: string,
  identity: CorrectionIdentity,
  store: OccupationCorrectionStore,
): Promise<void> {
  return store.releaseToken(
    tokenHash(token),
    deviceHash(identity),
    claimId,
  );
}
