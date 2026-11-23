import fs from 'node:fs';
import path from 'node:path';
import { filterItems } from '../src/js/filter.ts';
import type { Department, EquipmentItem, Lab, LabDataset } from '../src/js/types.ts';
import { stripMarkup } from './geminiClient.ts';

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

interface LoadedCatalog {
  departments: Department[];
  labs: Lab[];
  items: EquipmentItem[];
  compact: CompactCatalogEntry[];
  validItemIds: Set<string>;
}

const STOP_WORDS = new Set([
  'with',
  'that',
  'this',
  'from',
  'into',
  'your',
  'need',
  'want',
  'project',
  'using',
  'about',
  'some',
  'lab',
  'labs',
  'equipment',
  'device',
  'devices',
  'study',
  'testing',
  'test',
  'analysis',
  'check',
  'build',
  'make',
  'have',
  'will',
]);

let cachedCatalog: LoadedCatalog | null = null;

export function loadServerCatalog(): LoadedCatalog {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const dataPath = path.resolve(process.cwd(), 'src/data/labs.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const dataset = JSON.parse(raw) as LabDataset;

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

/**
 * Keyword-based fallback matching using the shared pure filter module.
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

  const scoreByItem = new Map<string, { item: EquipmentItem; matched: string[] }>();

  for (const token of tokens) {
    const matches = filterItems(
      catalog.items,
      { query: token },
      { departments: catalog.departments, labs: catalog.labs }
    );
    for (const item of matches) {
      const existing = scoreByItem.get(item.id) ?? { item, matched: [] };
      if (!existing.matched.includes(token)) {
        existing.matched.push(token);
      }
      scoreByItem.set(item.id, existing);
    }
  }

  const ranked = [...scoreByItem.values()].sort((a, b) => {
    if (b.matched.length !== a.matched.length) {
      return b.matched.length - a.matched.length;
    }
    const statusWeight = (item: EquipmentItem) =>
      item.status === 'Available' ? 2 : item.status === 'Limited' ? 1 : 0;
    const diff = statusWeight(b.item) - statusWeight(a.item);
    if (diff !== 0) return diff;
    return a.item.id.localeCompare(b.item.id);
  });

  if (ranked.length > 0) {
    return ranked.slice(0, 5).map(({ item, matched }) => ({
      itemId: item.id,
      reason: stripMarkup(
        `Matches "${matched.slice(0, 3).join(', ')}" in ${item.type.toLowerCase()} specs.`,
        119
      ),
    }));
  }

  // If no specific keywords matched, surface up to 3 available open-access items as safe starting points.
  return catalog.items
    .filter((item) => item.status === 'Available' && item.accessLevel === 'Open')
    .slice(0, 3)
    .map((item) => ({
      itemId: item.id,
      reason: stripMarkup(
        `Open-access ${item.type.toLowerCase()} available for quick prototyping.`,
        119
      ),
    }));
}
