"use client";

import { useId, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { POSE_GROUPS, searchPoses, suggestedPoses } from "@/lib/pose-picker";
import { POSE_IDS, POSE_LABELS } from "@/lib/poses";
import type { PoseId } from "@/lib/types";
import { StickFigure } from "./StickFigure";
import { fieldClass } from "./ui";

type Props = {
  value: PoseId;
  onChange: (pose: PoseId) => void;
  /** The text of the step, used to suggest poses that fit what it says. */
  stepText?: string;
  /** Set while a movement track drives the figure: the choice then only applies without the track. */
  secondary?: boolean;
};

function PoseTile({
  pose,
  selected,
  onSelect,
}: {
  pose: PoseId;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-[108px] flex-col items-center gap-1 rounded-2xl border p-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest ${
        selected ? "border-forest bg-sage" : "border-sand/70 bg-white/60"
      }`}
    >
      <StickFigure pose={pose} className="h-20 w-full" />
      <span className="flex items-center gap-1 text-[11px] leading-tight text-forest-dark">
        {selected && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
        {POSE_LABELS[pose]}
      </span>
    </button>
  );
}

export function PosePicker({ value, onChange, stepText = "", secondary = false }: Props) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const searchId = useId();

  const suggestions = useMemo(() => suggestedPoses(stepText, value), [stepText, value]);
  const results = useMemo(() => searchPoses(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-2xl bg-white/60 p-2">
        <StickFigure pose={value} className="h-20 w-16 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-forest-light">
            {secondary ? "Pose ohne Bewegungsspur" : "Gewählte Pose"}
          </p>
          <p className="font-display text-lg leading-tight text-forest-dark">{POSE_LABELS[value]}</p>
          <p className="text-xs text-forest-light">
            {secondary
              ? "Gilt, sobald keine Spur mehr an der Übung hängt."
              : "So zeigt die Figur diesen Schritt."}
          </p>
        </div>
      </div>

      {!searching && (
        <>
          <p className="text-xs text-forest-light">
            {stepText.trim() ? "Passt zum Schritttext:" : "Häufig gebraucht:"}
          </p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {suggestions.map((pose) => (
              <PoseTile key={pose} pose={pose} selected={pose === value} onSelect={() => onChange(pose)} />
            ))}
          </div>
        </>
      )}

      <label className="flex items-center gap-2 rounded-2xl border border-sand bg-white/70 px-3" htmlFor={searchId}>
        <Search className="h-4 w-4 shrink-0 text-forest-light" aria-hidden="true" />
        <input
          id={searchId}
          className={`${fieldClass} border-0 bg-transparent px-0 focus:ring-0 focus-visible:ring-0`}
          placeholder="Pose suchen, z. B. Nacken"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {searching ? (
        results.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {results.map((pose) => (
              <PoseTile key={pose} pose={pose} selected={pose === value} onSelect={() => onChange(pose)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-forest-light" role="status">
            Keine Pose mit diesem Namen. Versuche „Nacken“, „Atem“, „Liegen“ oder „Schulter“.
          </p>
        )
      ) : (
        <>
          <button
            type="button"
            className="text-sm text-forest underline"
            aria-expanded={showAll}
            onClick={() => setShowAll((open) => !open)}
          >
            {showAll ? "Liste schließen" : `Alle ${POSE_IDS.length} Posen nach Körperteil`}
          </button>
          {showAll && (
            <div className="space-y-3">
              {POSE_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="mb-1 text-xs uppercase tracking-[0.16em] text-forest-light">{group.title}</p>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {group.poses.map((pose) => (
                      <PoseTile key={pose} pose={pose} selected={pose === value} onSelect={() => onChange(pose)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
