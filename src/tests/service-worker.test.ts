import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const serviceWorkerSource = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

describe("PWA service worker safety", () => {
  it("does not intercept or cache cross-origin cloud/API requests", () => {
    expect(serviceWorkerSource).toContain("new URL(request.url).origin === self.location.origin");
    expect(serviceWorkerSource).toContain("if (!sameOriginRequest(request)) return;");
  });

  it("only caches same-origin static app assets after successful responses", () => {
    expect(serviceWorkerSource).toContain("request.destination === \"script\"");
    expect(serviceWorkerSource).toContain("url.pathname.includes(\"/_next/static/\")");
    expect(serviceWorkerSource).toContain("if (response.ok)");
  });

  it("uses the offline page only for app navigation, not failed JavaScript or CSS assets", () => {
    const navigationOfflineFallbacks = serviceWorkerSource.match(/catch\(\(\) => caches\.match\("\.\/offline\.html"\)\)/g) || [];
    expect(navigationOfflineFallbacks).toHaveLength(1);
    expect(serviceWorkerSource).toContain(".catch(() => Response.error())");
  });
});
