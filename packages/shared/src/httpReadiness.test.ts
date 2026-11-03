import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientError } from "effect/http";

import { waitForHttpReady } from "./httpReadiness.ts";

class NotReady extends Schema.TaggedError<NotReady>()("NotReady", { attempt: Schema.Number }) {}

describe("waitForHttpReady", () => {
  it.effect("probes quickly during the fast window, then at the normal interval", () =>
    Effect.gen(function* () {
      let probes = 0;
      const refusing = HttpClient.make((request) =>
        Effect.suspend(() => {
          probes += 1;
          return Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({ request }),
            }),
          );
        }),
      );
      const waiting = yield* waitForHttpReady({
        baseUrl: "http://127.0.0.1:3773",
        timeoutMs: 60_000,
        intervalMs: 100,
        fastIntervalMs: 20,
        fastWindowMs: 2_000,
        makeError: ({ attempt }) => new NotReady({ attempt }),
      }).pipe(Effect.provideService(HttpClient.HttpClient, refusing), Effect.forkChild);

      yield* TestClock.adjust("2 seconds");
      const duringFastWindow = probes;
      yield* TestClock.adjust("1 second");
      const afterOneMoreSecond = probes - duringFastWindow;
      yield* Fiber.interrupt(waiting);

      assert.isAtLeast(duringFastWindow, 95);
      assert.isAtMost(afterOneMoreSecond, 11);
    }).pipe(Effect.provide(TestClock.layer())),
  );
});
