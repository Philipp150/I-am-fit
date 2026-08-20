"use client";

import type { ReactNode } from "react";
import { getChildren } from "@/lib/categories";
import type { Category } from "@/lib/types";

export function CategoryPicker({
  categories,
  selected,
  onToggle,
}: {
  categories: Category[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {getChildren(categories, null).map((root) => (
        <Branch
          key={root.id}
          category={root}
          categories={categories}
          selected={selected}
          onToggle={onToggle}
          depth={0}
        />
      ))}
    </div>
  );
}

function Branch({
  category,
  categories,
  selected,
  onToggle,
  depth,
}: {
  category: Category;
  categories: Category[];
  selected: string[];
  onToggle: (id: string) => void;
  depth: number;
}) {
  const children = getChildren(categories, category.id);
  return (
    <div style={{ marginLeft: depth * 12 }}>
      <label className="flex items-center gap-2 py-1 text-sm">
        <input
          type="checkbox"
          checked={selected.includes(category.id)}
          onChange={() => onToggle(category.id)}
          className="accent-forest"
        />
        <span className={depth === 0 ? "font-medium text-forest-dark" : "text-ink"}>{category.name}</span>
      </label>
      {children.map((child) => (
        <Branch
          key={child.id}
          category={child}
          categories={categories}
          selected={selected}
          onToggle={onToggle}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const roots = getChildren(categories, null);
  const children = selected ? getChildren(categories, selected) : [];
  const parentOfSelected = categories.find((category) => category.id === selected)?.parentId ?? null;
  const visible = selected && children.length === 0 ? getChildren(categories, parentOfSelected) : children;

  return (
    <div className="space-y-2">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        <Chip active={selected === null} onClick={() => onSelect(null)}>
          Alle
        </Chip>
        {roots.map((category) => (
          <Chip key={category.id} active={selected === category.id || isUnder(categories, selected, category.id)} onClick={() => onSelect(category.id)}>
            {category.name}
          </Chip>
        ))}
      </div>
      {selected && visible.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {visible.map((category) => (
            <Chip key={category.id} active={selected === category.id} onClick={() => onSelect(category.id)}>
              {category.name}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function isUnder(categories: Category[], selected: string | null, rootId: string): boolean {
  if (!selected) return false;
  let current = categories.find((category) => category.id === selected);
  while (current) {
    if (current.id === rootId) return true;
    current = current.parentId ? categories.find((category) => category.id === current?.parentId) : undefined;
  }
  return false;
}

function Chip({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${active ? "bg-forest text-cream" : "bg-white/70 text-forest"}`}
    >
      {children}
    </button>
  );
}
