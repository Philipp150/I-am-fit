"use client";

export function ThemeChips({
  items,
  selectedIds,
  onSelect,
  labelledBy,
}: {
  items: Array<{ id: string; label: string }>;
  selectedIds: string[];
  onSelect: (id: string) => void;
  labelledBy?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-labelledby={labelledBy}>
      {items.map((item) => {
        const active = selectedIds.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`rounded-full px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest ${active ? "bg-forest text-cream" : "bg-white/70 text-forest-dark"}`}
            aria-pressed={active}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
