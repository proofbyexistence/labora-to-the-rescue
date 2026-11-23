/**
 * Server-side catalog loader and deterministic keyword fallback for equipment suggestions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LIMITS } from '../src/js/constants.ts';
import { filterItems } from '../src/js/filter.ts';
import type { Department, EquipmentItem, Lab, LabDataset } from '../src/js/types.ts';
import { stripMarkup } from './gemini-client.ts';

export interface CompactCatalogEntry {
  id: string;
  name: string;
  type: string;
  department: string;
  lab: string;
  specs: string;
}

export interface EquipmentSuggestion {
  itemId: string;
  reason: string;
}

export interface LoadedCatalog {
  departments: Department[];
  labs: Lab[];
  items: EquipmentItem[];
  compact: CompactCatalogEntry[];
  validItemIds: Set<string>;
}

const STOP_WORDS = new Set([
  'with', 'that', 'this', 'from', 'into', 'your', 'need', 'want', 'project', 'using',
  'about', 'some', 'lab', 'labs', 'equipment', 'device', 'devices', 'study', 'testing',
  'test', 'analysis', 'check', 'build', 'make', 'have', 'will',
]);

let cachedCatalog: LoadedCatalog | null = null;

/**
 * Reads and caches the campus catalog JSON for server-side validation and prompts.
 *
 * @returns Cached departments, labs, items, compact prompt entries, and valid ID set.
 */
export function loadServerCatalog(): LoadedCatalog {
  if (cachedCatalog) return cachedCatalog;

  const dataPath = path.resolve(process.cwd(), 'src/data/labs.json');
  const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as LabDataset;
  const deptById = new Map(dataset.departments.map((d) => [d.id, d.name]));
  const labById = new Map(dataset.labs.map((l) => [l.id, l.name]));

  const compact: CompactCatalogEntry[] = dataset.items.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    department: deptById.get(item.departmentId) ?? item.departmentId,
    lab: labById.get(item.labId) ?? item.labId,
    specs: item.specs,
  }));

  cachedCatalog = {
    departments: dataset.departments,
    labs: dataset.labs,
    items: dataset.items,
    compact,
    validItemIds: new Set(dataset.items.map((i) => i.id)),
  };
  return cachedCatalog;
}

function rankCatalogMatches(
  catalog: LoadedCatalog,
  tokens: string[]
): Array<{ item: EquipmentItem; matched: string[] }> {
  const scoreByItem = new Map<string, { item: EquipmentItem; matched: string[] }>();
  for (const token of tokens) {
    const matches = filterItems(
      catalog.items,
      { query: token },
      { departments: catalog.departments, labs: catalog.labs }
    );
    for (const item of matches) {
      const existing = scoreByItem.get(item.id) ?? { item, matched: [] };
      if (!existing.matched.includes(token)) existing.matched.push(token);
      scoreByItem.set(item.id, existing);
    }
  }
  const statusWeight = (item: EquipmentItem) =>
    item.status === 'Available' ? 2 : item.status === 'Limited' ? 1 : 0;

  return [...scoreByItem.values()].sort((a, b) => {
    if (b.matched.length !== a.matched.length) return b.matched.length - a.matched.length;
    const diff = statusWeight(b.item) - statusWeight(a.item);
    return diff !== 0 ? diff : a.item.id.localeCompare(b.item.id);
  });
}

/**
 * Generates deterministic keyword-matched equipment suggestions when AI is unavailable.
 *
 * @param projectText - Normalized student project description.
 * @returns Up to `LIMITS.AI_MAX_SUGGESTIONS` matching or starter open-access equipment suggestions.
 */
export function suggestEquipmentFallback(projectText: string): EquipmentSuggestion[] {
  const catalog = loadServerCatalog();
  const tokens = [
    ...new Set(
      projectText
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
    ),
  ].slice(0, 14);

  const ranked = rankCatalogMatches(catalog, tokens);
  if (ranked.length > 0) {
    return ranked.slice(0, LIMITS.AI_MAX_SUGGESTIONS).map(({ item, matched }) => ({
      itemId: item.id,
      reason: stripMarkup(
        `Matches "${matched.slice(0, 3).join(', ')}" in ${item.type.toLowerCase()} specs.`,
        LIMITS.AI_REASON_MAX
      ),
    }));
  }

  return catalog.items
    .filter((item) => item.status === 'Available' && item.accessLevel === 'Open')
    .slice(0, 3)
    .map((item) => ({
      itemId: item.id,
      reason: stripMarkup(
        `Open-access ${item.type.toLowerCase()} available for quick prototyping.`,
        LIMITS.AI_REASON_MAX
      ),
    }));
}
