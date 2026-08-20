"use client";

import { fieldClass, Field } from "./ui";
import { rhythmLabel } from "@/lib/schedule";
import type { RhythmKind } from "@/lib/types";

const DAY_OPTIONS = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Di" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Do" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 0, label: "So" },
];

export type RhythmValue = {
  kind: RhythmKind;
  daysOfWeek?: number[];
  everyNDays?: number;
};

export function RhythmFields({
  value,
  onChange,
  keepUntil,
  onKeepUntil,
}: {
  value: RhythmValue;
  onChange: (value: RhythmValue) => void;
  keepUntil?: string | null;
  onKeepUntil?: (value: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Rhythmus">
        <select
          className={fieldClass}
          value={value.kind}
          onChange={(event) => onChange({ ...value, kind: event.target.value as RhythmKind })}
        >
          <option value="daily">jeden Tag</option>
          <option value="weekdays">unter der Woche</option>
          <option value="weekends">am Wochenende</option>
          <option value="days">an bestimmten Tagen</option>
          <option value="every_n_days">alle paar Tage</option>
        </select>
      </Field>
      {value.kind === "days" && (
        <div className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map((day) => {
            const active = value.daysOfWeek?.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => {
                  const current = new Set(value.daysOfWeek ?? []);
                  if (current.has(day.value)) current.delete(day.value);
                  else current.add(day.value);
                  onChange({ ...value, daysOfWeek: [...current] });
                }}
                className={`h-10 w-10 rounded-full text-sm ${active ? "bg-forest text-cream" : "bg-white/70 text-forest"}`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      )}
      {value.kind === "every_n_days" && (
        <Field label="Abstand in Tagen">
          <input
            type="number"
            min={2}
            max={14}
            className={fieldClass}
            value={value.everyNDays ?? 2}
            onChange={(event) => onChange({ ...value, everyNDays: Number(event.target.value) })}
          />
        </Field>
      )}
      {onKeepUntil && (
        <Field label="So lange im Plan">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className={fieldClass}
              value={keepUntil ? "until" : "always"}
              onChange={(event) => onKeepUntil(event.target.value === "always" ? null : keepUntil || new Date().toISOString().slice(0, 10))}
            >
              <option value="always">immer / unbegrenzt</option>
              <option value="until">bis zu einem Datum</option>
            </select>
            {keepUntil !== null && keepUntil !== undefined && (
              <input type="date" className={fieldClass} value={keepUntil} onChange={(event) => onKeepUntil(event.target.value)} />
            )}
          </div>
        </Field>
      )}
      <p className="text-sm text-forest-light">Aktuell: {rhythmLabel(value.kind, value.daysOfWeek, value.everyNDays)}</p>
    </div>
  );
}
