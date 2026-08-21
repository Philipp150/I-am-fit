import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPOSITORY_PATH = resolve(__dirname, "repository.ts");

function exportedFunctionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) {
    throw new Error(`Missing ${signature}`);
  }
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unclosed ${signature}`);
}

describe("repository exports for Vercel/TypeScript", () => {
  const source = readFileSync(REPOSITORY_PATH, "utf8");

  it("keeps getProfile as its own export so addCompletion stays Promise<void>", () => {
    expect(source).toContain("export async function getProfile(): Promise<Profile | undefined> {");
    expect(source).toContain("export async function addCompletion(item: Completion): Promise<void> {");

    const addCompletion = exportedFunctionBody(
      source,
      "export async function addCompletion(item: Completion): Promise<void> {",
    );
    expect(addCompletion).not.toContain("getDb().profile.get");
    expect(addCompletion).not.toContain('from("profiles")');
    expect(addCompletion).not.toContain("return profile");
    expect(addCompletion).not.toContain("return undefined");

    const getProfile = exportedFunctionBody(
      source,
      "export async function getProfile(): Promise<Profile | undefined> {",
    );
    expect(getProfile).toContain("getDb().profile.get");
    expect(getProfile).toContain('from("profiles")');
  });

  it("does not await cloud catalog hydrate inside bootstrap", () => {
    const bootstrap = exportedFunctionBody(source, "export async function bootstrap(): Promise<void> {");
    expect(bootstrap).toContain("runBootstrap");
    expect(bootstrap).toContain("hydrateCloud: hydrateCloudCatalog");
    expect(bootstrap).not.toContain("await hydrateOfflineFromCloud");
    expect(bootstrap).not.toContain("await hydrateCloudCatalog");
  });
});
