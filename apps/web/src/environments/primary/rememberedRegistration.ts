import { PrimaryConnectionRegistration } from "@t3tools/client-runtime/connection";
import { type DesktopEnvironmentBootstrap, PRIMARY_LOCAL_ENVIRONMENT_ID } from "@t3tools/contracts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { readPrimaryEnvironmentTarget, type PrimaryEnvironmentTarget } from "./target";

// The primary's id comes from its descriptor, which needs a running backend. Remembering it lets
// the desktop render cached state while the backend boots.
const STORAGE_KEY = "t3code:primary-environment-registration";

const RememberedJson = Schema.fromJsonString(
  Schema.Struct({ key: Schema.String, registration: PrimaryConnectionRegistration }),
);
const decodeRemembered = Schema.decodeUnknownOption(RememberedJson);
const encodeRemembered = Schema.encodeOption(RememberedJson);

export function primaryRegistrationSignature(target: PrimaryEnvironmentTarget): string {
  return `primary|${target.target.httpBaseUrl}|${target.target.wsBaseUrl}`;
}

// Windows and WSL primaries share an endpoint; the label tells them apart.
export function rememberedPrimaryKey(
  target: PrimaryEnvironmentTarget,
  bootstraps: ReadonlyArray<DesktopEnvironmentBootstrap>,
): string | null {
  if (target.source !== "desktop-managed") return null;
  const label = bootstraps.find((entry) => entry.id === PRIMARY_LOCAL_ENVIRONMENT_ID)?.label;
  return label === undefined ? null : `${primaryRegistrationSignature(target)}|${label}`;
}

export function encodeRememberedPrimaryRegistration(
  key: string,
  registration: PrimaryConnectionRegistration,
): string | undefined {
  return Option.getOrUndefined(encodeRemembered({ key, registration }));
}

export function readRememberedPrimaryRegistration(
  raw: string | null,
  key: string,
): PrimaryConnectionRegistration | undefined {
  if (raw === null) return undefined;
  return Option.getOrUndefined(
    decodeRemembered(raw).pipe(
      Option.filter((remembered) => remembered.key === key),
      Option.map((remembered) => remembered.registration),
    ),
  );
}

// A sync IPC read; a throw must not end the caller's work.
function readPrimaryBootstraps(): ReadonlyArray<DesktopEnvironmentBootstrap> {
  try {
    return window.desktopBridge?.getLocalEnvironmentBootstraps() ?? [];
  } catch {
    return [];
  }
}

export function recallPrimaryRegistration(
  target: PrimaryEnvironmentTarget,
): PrimaryConnectionRegistration | undefined {
  const key = rememberedPrimaryKey(target, readPrimaryBootstraps());
  if (key === null) return undefined;
  try {
    return readRememberedPrimaryRegistration(window.localStorage.getItem(STORAGE_KEY), key);
  } catch {
    return undefined;
  }
}

/** Keyed by the backend that answered, since a fetch can outlast a WSL fallback. */
export function rememberPrimaryRegistration(
  target: PrimaryEnvironmentTarget,
  registration: PrimaryConnectionRegistration,
): void {
  const key = rememberedPrimaryKey(target, readPrimaryBootstraps());
  const encoded = key === null ? undefined : encodeRememberedPrimaryRegistration(key, registration);
  if (encoded === undefined) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, encoded);
  } catch {}
}

export function hasRememberedPrimaryRegistration(): boolean {
  try {
    const target = readPrimaryEnvironmentTarget();
    return target !== null && recallPrimaryRegistration(target) !== undefined;
  } catch {
    return false;
  }
}
