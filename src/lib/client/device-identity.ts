const DEVICE_KEY = "offerlens_device_id";
const SALT_KEY = "offerlens_device_salt";

interface FingerprintSignals {
  userAgent: string;
  width: number;
  height: number;
  timezone: string;
  language: string;
}

export interface DeviceIdentity {
  deviceId: string;
  fingerprint: string;
}

export function buildFingerprintSource(signals: FingerprintSignals): string {
  return [
    signals.userAgent,
    `${signals.width}x${signals.height}`,
    signals.timezone,
    signals.language,
  ].join("|");
}

function fallbackDigest(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return Array.from({ length: 8 }, (_, seed) => {
    let hash = (0x811c9dc5 ^ Math.imul(seed + 1, 0x9e3779b9)) >>> 0;
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193) >>> 0;
      hash = (hash ^ (hash >>> 13)) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }).join("");
}

export async function digestIdentity(
  value: string,
  subtle: SubtleCrypto | null = globalThis.crypto?.subtle ?? null,
): Promise<string> {
  if (subtle) {
    try {
      const bytes = new TextEncoder().encode(value);
      const digest = await subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    } catch {
      // HTTP by IP can expose crypto without a usable SubtleCrypto implementation.
    }
  }
  return fallbackDigest(value);
}

interface DeviceSaltCrypto {
  randomUUID?: () => string;
  getRandomValues(values: Uint8Array): Uint8Array;
}

export function createDeviceSalt(
  browserCrypto: DeviceSaltCrypto | undefined = globalThis.crypto,
): string {
  if (typeof browserCrypto?.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }
  if (browserCrypto) {
    const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now()}-${Math.random()}-${Math.random()}`;
}

function persistCookie(deviceId: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${DEVICE_KEY}=${deviceId}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  let salt = localStorage.getItem(SALT_KEY);
  if (!salt) {
    salt = createDeviceSalt();
    localStorage.setItem(SALT_KEY, salt);
  }

  const source = buildFingerprintSource({
    userAgent: navigator.userAgent,
    width: window.screen.width,
    height: window.screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  });
  const fingerprint = await digestIdentity(source);

  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId || !/^[a-f0-9]{64}$/.test(deviceId)) {
    deviceId = await digestIdentity(`${source}|${salt}`);
    localStorage.setItem(DEVICE_KEY, deviceId);
  }
  persistCookie(deviceId);
  return { deviceId, fingerprint };
}
