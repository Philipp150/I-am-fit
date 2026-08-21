import { describe, expect, it } from "vitest";
import { nextStepIndex } from "./player";

describe("practice player", () => {
  it("advances until the last step, then finishes without looping", () => {
    expect(nextStepIndex(0, 3, false)).toEqual({ index: 1, finished: false });
    expect(nextStepIndex(2, 3, false)).toEqual({ index: 2, finished: true });
  });

  it("wraps when looping", () => {
    expect(nextStepIndex(2, 3, true)).toEqual({ index: 0, finished: false });
  });

  it("treats an empty sequence as finished", () => {
    expect(nextStepIndex(0, 0, false)).toEqual({ index: 0, finished: true });
  });
});
