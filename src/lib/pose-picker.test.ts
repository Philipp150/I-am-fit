import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  groupOfPose,
  POSE_GROUPS,
  POSE_SUGGESTION_LIMIT,
  searchPoses,
  suggestedPoses,
} from "./pose-picker";
import { POSE_IDS, POSE_LABELS } from "./poses";
import type { PoseId } from "./types";

function read(rel: string): string {
  return readFileSync(resolve(__dirname, rel), "utf8");
}

describe("pose picker", () => {
  it("puts every pose in exactly one group", () => {
    const listed = POSE_GROUPS.flatMap((group) => group.poses);
    expect([...listed].sort()).toEqual([...POSE_IDS].sort());
    expect(new Set(listed).size).toBe(listed.length);
    for (const pose of POSE_IDS) expect(groupOfPose(pose), pose).toBeDefined();
  });

  it("gives every group a German heading a body part can be found under", () => {
    for (const group of POSE_GROUPS) {
      expect(group.title.length).toBeGreaterThan(3);
      expect(group.poses.length).toBeGreaterThan(1);
    }
    expect(POSE_GROUPS.map((group) => group.title).join(" ")).toMatch(/Nacken/);
    expect(POSE_GROUPS.map((group) => group.title).join(" ")).toMatch(/Atem/);
  });

  it("finds poses by their German name, umlauts and case included", () => {
    expect(searchPoses("nacken")).toContain("neckLeft");
    expect(searchPoses("NACKEN links")).toEqual(["neckLeft"]);
    expect(searchPoses("hufte")).toContain("hipOpen");
    expect(searchPoses("Hüfte")).toContain("hipOpenOther");
    expect(searchPoses("atmen").length).toBeGreaterThan(2);
    expect(searchPoses("")).toEqual([]);
    expect(searchPoses("xyz")).toEqual([]);
  });

  it("suggests poses that match what the step says", () => {
    const neck = suggestedPoses("Kopf langsam nach links neigen", "stand");
    expect(neck).toContain("neckLeft");
    // The matching poses come first, ahead of the everyday fallbacks.
    expect(neck.indexOf("neckLeft")).toBeLessThan(4);
    const breath = suggestedPoses("Vier Sekunden einatmen, sechs ausatmen", "stand");
    expect(breath.some((pose) => pose.startsWith("breathe") || pose.startsWith("stand"))).toBe(true);
    const shrug = suggestedPoses("Schultern hochziehen und fallen lassen", "stand");
    expect(shrug).toContain("shrug");
  });

  it("always offers the selected pose first and stays short", () => {
    for (const selected of ["neckLeft", "plank", "lieHold"] as PoseId[]) {
      const list = suggestedPoses("", selected);
      expect(list[0]).toBe(selected);
      expect(list.length).toBeLessThanOrEqual(POSE_SUGGESTION_LIMIT);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("falls back to the neighbours of the selected pose without a step text", () => {
    const list = suggestedPoses("", "jawLeft");
    expect(list).toContain("jawRight");
    expect(list).toContain("jawSoft");
  });

  it("labels the tiles, shows the selection and does not dump all poses per step", () => {
    const picker = read("../components/PosePicker.tsx");
    expect(picker).toContain("POSE_LABELS[pose]");
    expect(picker).toContain("aria-pressed");
    expect(picker).toContain("suggestedPoses");
    expect(picker).toContain("searchPoses");
    expect(picker).toContain("POSE_GROUPS");
    expect(picker).toContain("Gewählte Pose");
    // The whole catalog stays behind one tap instead of filling the page for every step.
    expect(picker).toContain("showAll");

    const editor = read("../components/ExerciseEditor.tsx");
    expect(editor).toContain("PosePicker");
    expect(editor).not.toContain("POSE_IDS.map");
    expect(editor).not.toContain("grid-cols-5");
  });

  it("says that a movement track drives the figure and asks before dropping it", () => {
    const editor = read("../components/ExerciseEditor.tsx");
    expect(editor).toContain("Die Figur folgt der Bewegungsspur");
    expect(editor).toContain("Spur verwenden");
    expect(editor).toContain("Pose wählen");
    expect(editor).toContain("Spur entfernen und Posen nutzen");
    expect(editor).toContain("hasPlayableTrack");
    // Removing the track is the only way the poses take over, and it takes a second tap.
    expect(editor).toContain("poseTrack: undefined");
  });

  it("keeps the labels short enough to read on a phone", () => {
    for (const pose of POSE_IDS) {
      expect(POSE_LABELS[pose].length, pose).toBeLessThanOrEqual(24);
    }
  });
});
