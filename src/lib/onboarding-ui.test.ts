import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(resolve(__dirname, rel), "utf8");
}

describe("60-second onboarding UI", () => {
  it("turns first-run Heute into complaints → today instead of a catalog tour", () => {
    const home = read("../app/page.tsx");
    expect(home).toContain("OnboardingFlow");
    expect(home).toContain("shouldShowOnboarding");
    expect(home).toContain("OnboardingReminder");
    expect(home).toContain("Unwohl");
    expect(home).not.toContain("Diese drei in den Plan");
    expect(home).not.toContain("ex-mantra-here");
    expect(home).not.toContain("adoptStarters");
    expect(home).not.toContain("Bitte anmelden");
    expect(home).not.toContain("Konto erstellen");
    expect(home).not.toContain("Schuld");
  });

  it("keeps the flow German, offline-capable, and free of account pressure", () => {
    const onboarding = read("../components/Onboarding.tsx");
    expect(onboarding).toContain("Was merkst du gerade?");
    expect(onboarding).toContain("QUICK_PATHS");
    expect(onboarding).toContain("Erinnerung um {time} an");
    expect(onboarding).toContain("Kein Konto");
    expect(onboarding).toContain("Das reicht für heute");
    expect(onboarding).toContain("Erst mal umsehen");
    expect(onboarding).toContain("auch offline");
    expect(onboarding).toContain("Erinnerung, wenn du magst");
    expect(onboarding).not.toContain("Du musst");
    expect(onboarding).not.toContain("Konto erstellen");
    expect(onboarding).not.toContain("ThemeChips");
    expect(onboarding).not.toContain("ONBOARDING_THEMES");
  });

  it("lets empty-plan complaints land on Heute without wiping a returning plan", () => {
    const complaints = read("../app/complaints/page.tsx");
    expect(complaints).toContain("seedOnboardingPlan");
    expect(complaints).toContain("Für heute übernehmen");
    expect(complaints).toContain("emptyPlan");
    expect(complaints).toContain('router.push("/")');
    expect(complaints).toContain("Die ersten in den Plan");
    expect(complaints).toContain("enabledPlanItems");
  });
});
