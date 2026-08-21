import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Providers catalog splash", () => {
  const source = readFileSync(resolve(__dirname, "Providers.tsx"), "utf8");

  it("always renders the app shell and never full-screen gates on cloud ready", () => {
    expect(source).toContain("{children}");
    expect(source).toContain("catalogStatusMessage");
    expect(source).not.toMatch(/if\s*\(\s*!ready\s*\)/);
    expect(source).not.toContain("flex min-h-screen flex-col items-center justify-center");
  });
});
