import {
  PrimaryConnectionRegistration,
  PrimaryConnectionTarget,
} from "@t3tools/client-runtime/connection";
import { EnvironmentId, PRIMARY_LOCAL_ENVIRONMENT_ID } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  encodeRememberedPrimaryRegistration,
  readRememberedPrimaryRegistration,
  rememberedPrimaryKey,
} from "./rememberedRegistration";

const target = {
  source: "desktop-managed" as const,
  target: { httpBaseUrl: "http://127.0.0.1:3773/", wsBaseUrl: "ws://127.0.0.1:3773/" },
};
const bootstrap = (label: string) => [
  { id: PRIMARY_LOCAL_ENVIRONMENT_ID, label, httpBaseUrl: null, wsBaseUrl: null },
];
const registration = new PrimaryConnectionRegistration({
  target: new PrimaryConnectionTarget({
    environmentId: EnvironmentId.make("env-local"),
    label: "Local",
    httpBaseUrl: "http://127.0.0.1:3773/",
    wsBaseUrl: "ws://127.0.0.1:3773/",
  }),
});

describe("remembered primary registration", () => {
  it("keys desktop primaries per backend, not per shared endpoint", () => {
    const windows = rememberedPrimaryKey(target, bootstrap("Windows"));
    const wsl = rememberedPrimaryKey(target, bootstrap("WSL (Ubuntu)"));
    expect(windows).not.toBeNull();
    expect(windows).not.toBe(wsl);
    expect(rememberedPrimaryKey({ ...target, source: "window-origin" }, bootstrap("Windows"))).toBe(
      null,
    );
  });

  it("recalls what it stored only under the same key", () => {
    const key = rememberedPrimaryKey(target, bootstrap("Windows"))!;
    const raw = encodeRememberedPrimaryRegistration(key, registration) ?? null;
    expect(readRememberedPrimaryRegistration(raw, key)).toEqual(registration);
    expect(
      readRememberedPrimaryRegistration(raw, rememberedPrimaryKey(target, bootstrap("WSL"))!),
    ).toBeUndefined();
    expect(readRememberedPrimaryRegistration("{not json", key)).toBeUndefined();
    expect(readRememberedPrimaryRegistration(null, key)).toBeUndefined();
  });
});
