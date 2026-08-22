import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SRC = resolve(ROOT, "src");
const CI_WORKFLOW = resolve(ROOT, ".github/workflows/ci.yml");
const NEXT_CONFIG = resolve(ROOT, "next.config.ts");

const IMPORT_RE = /(?:from|import)\s*\(?\s*["']@\/([^"']+)["']/g;

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function moduleExists(fromSrc: string): boolean {
  const base = resolve(SRC, fromSrc);
  const files = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.json`];
  if (files.some((file) => existsSync(file) && statSync(file).isFile())) return true;
  return (
    existsSync(base) &&
    statSync(base).isDirectory() &&
    ["index.ts", "index.tsx", "index.js"].some((index) => existsSync(join(base, index)))
  );
}

function listedPackages(source: string, key: string): string[] {
  const match = source.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
}

describe("Vercel production build guard", () => {
  it("runs the same npm run build command as Vercel on every GitHub push, not only main", () => {
    const ci = readFileSync(CI_WORKFLOW, "utf8");
    expect(ci).toContain("name: CI");
    expect(ci).toMatch(/^on:\n  push:\n  pull_request:/m);
    expect(ci).not.toContain("branches: [main]");
    expect(ci).toContain("- run: npm test");
    expect(ci).toContain("- run: npm run lint");
    expect(ci).toContain("- run: npm run build");
    const buildIndex = ci.indexOf("- run: npm run build");
    const testIndex = ci.indexOf("- run: npm test");
    expect(buildIndex).toBeGreaterThan(testIndex);
  });

  it("does not put the same package in transpilePackages and serverExternalPackages", () => {
    const source = readFileSync(NEXT_CONFIG, "utf8");
    const transpile = listedPackages(source, "transpilePackages");
    const external = listedPackages(source, "serverExternalPackages");
    const overlap = transpile.filter((pkg) => external.includes(pkg));
    expect(overlap).toEqual([]);
    expect(transpile).toContain("@mediapipe/tasks-vision");
    expect(external).toContain("tesseract.js");
    expect(transpile).not.toContain("tesseract.js");
    expect(external).not.toContain("@mediapipe/tasks-vision");
  });

  it("keeps ThemeChips as a real module because Onboarding imports it", () => {
    const chips = resolve(SRC, "components/ThemeChips.tsx");
    const onboarding = readFileSync(resolve(SRC, "components/Onboarding.tsx"), "utf8");
    expect(existsSync(chips)).toBe(true);
    expect(onboarding).toContain('from "@/components/ThemeChips"');
    expect(onboarding).toContain("ThemeChips");
  });

  it("resolves every @/ import in app and lib source so next build cannot miss a file", () => {
    const missing: string[] = [];
    for (const file of collectSourceFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(IMPORT_RE)) {
        const spec = match[1];
        if (!moduleExists(spec)) {
          missing.push(`${file.slice(SRC.length + 1)} → @/${spec}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps CaptionTrack parsing null-safe for next build TypeScript", () => {
    const extract = readFileSync(resolve(SRC, "lib/extract-meta.ts"), "utf8");
    expect(extract).toContain("captionTrackFromUnknown");
    expect(extract).toContain("if (track) tracks.push(track)");
    expect(extract).not.toMatch(/return parsed\s*\.map\(/);
  });

  it("keeps getProfile as a standalone export so addCompletion stays void", () => {
    const repository = readFileSync(resolve(SRC, "lib/repository.ts"), "utf8");
    expect(repository).toContain("export async function getProfile(): Promise<Profile | undefined> {");
    expect(repository).toContain("export async function addCompletion(item: Completion): Promise<void> {");
    const addStart = repository.indexOf("export async function addCompletion(item: Completion): Promise<void> {");
    const nextExport = repository.indexOf("\nexport ", addStart + 10);
    const addBody = repository.slice(addStart, nextExport);
    expect(addBody).not.toContain("getDb().profile.get");
    expect(addBody).not.toContain('from("profiles")');
  });
});
