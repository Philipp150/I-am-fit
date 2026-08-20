import type { Category } from "./types";

export function getChildren(categories: Category[], parentId: string | null): Category[] {
  return categories.filter((category) => category.parentId === parentId);
}

export function getAncestors(categories: Category[], id: string): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const chain: Category[] = [];
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

export function getDescendantIds(categories: Category[], id: string): string[] {
  const ids = new Set<string>([id]);
  let added = true;
  while (added) {
    added = false;
    for (const category of categories) {
      if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        added = true;
      }
    }
  }
  return [...ids];
}

export function categoryPathLabel(categories: Category[], id: string): string {
  return getAncestors(categories, id)
    .map((category) => category.name)
    .join(" · ");
}

export function matchesCategoryFilter(
  exerciseCategoryIds: string[],
  selectedId: string | null,
  categories: Category[],
): boolean {
  if (!selectedId) return true;
  const allowed = new Set(getDescendantIds(categories, selectedId));
  return exerciseCategoryIds.some((id) => allowed.has(id));
}
