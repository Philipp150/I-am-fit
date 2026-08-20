"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryChips } from "@/components/CategoryPicker";
import { ExerciseCard } from "@/components/ExerciseCard";
import { fieldClass } from "@/components/ui";
import { matchesCategoryFilter } from "@/lib/categories";
import { useCategories, useExercises } from "@/lib/hooks";

export default function CatalogPage() {
  const exercises = useExercises();
  const categories = useCategories();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<"all" | "catalog" | "mine">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((exercise) => {
      if (origin === "catalog" && !exercise.isSystem) return false;
      if (origin === "mine" && exercise.isSystem) return false;
      if (!matchesCategoryFilter(exercise.categoryIds, categoryId, categories)) return false;
      if (!q) return true;
      return `${exercise.title} ${exercise.summary}`.toLowerCase().includes(q);
    });
  }, [exercises, query, categoryId, categories, origin]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Link href="/catalog/new" className="rounded-full bg-forest px-4 py-2 text-sm text-cream">
          Selbst anlegen
        </Link>
        <Link href="/catalog/import" className="rounded-full bg-clay px-4 py-2 text-sm text-cream">
          Link importieren
        </Link>
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Suchen in der Sammlung"
        className={fieldClass}
      />
      <div className="flex gap-2">
        {(["all", "catalog", "mine"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setOrigin(value)}
            className={`rounded-full px-3 py-1.5 text-sm ${origin === value ? "bg-forest text-cream" : "bg-white/70 text-forest"}`}
          >
            {value === "all" ? "Alle" : value === "catalog" ? "Katalog" : "Meine"}
          </button>
        ))}
      </div>
      <CategoryChips categories={categories} selected={categoryId} onSelect={setCategoryId} />
      <p className="text-sm text-forest-light">{filtered.length} Übungen · auch Mantras und Atem</p>
      <div className="space-y-2">
        {filtered.map((exercise) => (
          <ExerciseCard key={exercise.id} exercise={exercise} />
        ))}
      </div>
    </div>
  );
}
