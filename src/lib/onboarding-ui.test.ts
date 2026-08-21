import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(resolve(__dirname, rel), "utf8");
}

const UI_FILES = [
  "../app/page.tsx",
  "../app/complaints/page.tsx",
  "../app/catalog/page.tsx",
  "../app/catalog/[id]/page.tsx",
  "../components/AppShell.tsx",
  "../components/ExerciseEditor.tsx",
  "../components/Onboarding.tsx",
  "../components/ThemeChips.tsx",
];

describe("theme language in the UI", () => {
  it("does not show Beschwerde to people who may want abs, not a diagnosis", () => {
    for (const rel of UI_FILES) {
      expect(read(rel), rel).not.toMatch(/Beschwerde/i);
    }
  });

  it("turns first-run Heute into Thema → Heute instead of a catalog tour", () => {
    const home = read("../app/page.tsx");
    expect(home).toContain("OnboardingFlow");
    expect(home).toContain("shouldShowOnboarding");
    expect(home).toContain("Worum soll’s gehen?");
    expect(home).not.toContain("Diese drei in den Plan");
    expect(home).not.toContain("ex-mantra-here");
    expect(home).not.toContain("adoptStarters");
    expect(home).not.toContain("Unwohl");
  });

  it("keeps the flow German with 60-second chips including Bauch", () => {
    const onboarding = read("../components/Onboarding.tsx");
    expect(onboarding).toContain("Worum soll’s gehen?");
    expect(onboarding).toContain("ONBOARDING_THEMES");
    expect(onboarding).toContain("ThemeChips");
    expect(onboarding).toContain("Auch Bauch zählt");
    expect(onboarding).toContain("Das reicht für heute");
    expect(onboarding).toContain("kein Konto");
    expect(onboarding).toContain("auch offline");
    expect(onboarding).toContain("Erinnerung um {time} an");
    expect(onboarding).not.toContain("Du musst");
  });

  it("lets an empty plan take a theme to Heute without wiping a returning plan", () => {
    const complaints = read("../app/complaints/page.tsx");
    expect(complaints).toContain("seedOnboardingPlan");
    expect(complaints).toContain("Für heute übernehmen");
    expect(complaints).toContain("emptyPlan");
    expect(complaints).toContain('router.push("/")');
    expect(complaints).toContain("Die ersten in den Plan");
    expect(complaints).toContain("enabledPlanItems");
  });
});
