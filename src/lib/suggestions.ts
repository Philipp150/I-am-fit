import type { Complaint, Exercise } from "./types";

export function suggestExercisesForComplaints(
  complaintIds: string[],
  exercises: Exercise[],
): Exercise[] {
  if (complaintIds.length === 0) return [];
  const selected = new Set(complaintIds);
  const scored = exercises
    .map((exercise) => {
      const overlap = exercise.complaintIds.filter((id) => selected.has(id)).length;
      return { exercise, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.exercise.title.localeCompare(b.exercise.title));
  return scored.map((entry) => entry.exercise);
}

export function complaintNames(ids: string[], complaints: Complaint[]): string {
  const byId = new Map(complaints.map((complaint) => [complaint.id, complaint.name]));
  return ids.map((id) => byId.get(id)).filter(Boolean).join(", ");
}
