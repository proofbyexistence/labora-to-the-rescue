/**
 * Discover catalog page: multi-faceted equipment filtering, pagination, and AI project finder.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Search, Sparkles } from 'lucide-react';
import { EquipmentCard, type PageId } from '../components/EquipmentCard';
import { HeroBenchDoodle } from '../components/LabDoodles';
import {
  formatAiSourceLabel,
  suggestEquipment,
  validateProjectDescription,
  type AiSource,
  type EquipmentSuggestion,
} from '../js/ai-client';
import {
  filterItems,
  paginateItems,
  type DiscoverFilterCriteria,
} from '../js/filter';
import {
  getDepartments,
  getItemById,
  getItems,
  getLabs,
  getStateVersion,
} from '../js/labData';
import type { AccessLevel, AvailabilityStatus, EquipmentType } from '../js/types';

interface DiscoverPageProps {
  filters: Required<DiscoverFilterCriteria>;
  catalogPage: number;
  onUpdateFilters: (next: Partial<DiscoverFilterCriteria>) => void;
  onClearFilters: () => void;
  onChangePage: (page: number) => void;
  onNavigate: (
    page: PageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => void;
  onInspectItem: (itemId: string, trigger?: HTMLButtonElement | null) => void;
}

const EQUIPMENT_TYPES: EquipmentType[] = [
  'Instruments',
  'Development kits',
  'Workstations',
  'Safety gear',
];

const STATUS_OPTIONS: AvailabilityStatus[] = ['Available', 'Limited', 'Booked'];

const ACCESS_OPTIONS: AccessLevel[] = [
  'Open',
  'Needs faculty approval',
  'Training required',
];

const PAGE_SIZE = 9;

const PROJECT_EXAMPLES = [
  'Measure frequency response and filter ripple on a 20 MHz analog circuit prototype.',
  'Fabricate a microfluidic PDMS chip and inspect channel alignment under magnification.',
  'Train a lightweight computer vision model and deploy real-time inference on an edge board.',
];

export function DiscoverPage({
  filters,
  catalogPage,
  onUpdateFilters,
  onClearFilters,
  onChangePage,
  onNavigate,
  onInspectItem,
}: DiscoverPageProps) {
  const [searchDraft, setSearchDraft] = useState(filters.query);
  const [projectDraft, setProjectDraft] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<EquipmentSuggestion[]>([]);
  const [aiSource, setAiSource] = useState<AiSource | null>(null);
  const [aiStatusNote, setAiStatusNote] = useState('');
  const projectInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync local input when filters change via Clear filters or browser Back/Forward.
  useEffect(() => {
    setSearchDraft(filters.query);
  }, [filters.query]);

  // Debounce live search updates by 250 ms to keep filtering responsive without hash thrashing.
  useEffect(() => {
    if (searchDraft === filters.query) {
      return;
    }
    const timer = window.setTimeout(() => {
      onUpdateFilters({ query: searchDraft });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.query, onUpdateFilters]);

  const dataVersion = getStateVersion();

  const { departments, allLabs, allItems, departmentMap, labMap } = useMemo(() => {
    const depts = getDepartments();
    const labs = getLabs();
    const items = getItems();
    return {
      departments: depts,
      allLabs: labs,
      allItems: items,
      departmentMap: new Map(depts.map((d) => [d.id, d])),
      labMap: new Map(labs.map((l) => [l.id, l])),
    };
  }, [dataVersion]);

  const scopedLabs = useMemo(
    () =>
      filters.departmentId
        ? allLabs.filter((lab) => lab.departmentId === filters.departmentId)
        : allLabs,
    [allLabs, filters.departmentId]
  );

  const matchingItems = useMemo(
    () =>
      filterItems(allItems, filters, {
        departments,
        labs: allLabs,
      }),
    [allItems, filters, departments, allLabs]
  );

  const paginated = useMemo(
    () => paginateItems(matchingItems, catalogPage, PAGE_SIZE),
    [matchingItems, catalogPage]
  );

  const activeDepartment = filters.departmentId
    ? departmentMap.get(filters.departmentId)
    : undefined;
  const activeLab = filters.labId ? labMap.get(filters.labId) : undefined;

  const hasFilters = Boolean(
    filters.departmentId ||
      filters.labId ||
      searchDraft.trim() ||
      filters.type ||
      filters.status ||
      filters.accessLevel
  );

  const countLabel =
    paginated.totalItems === 1
      ? '1 item found'
      : `${paginated.totalItems} items found`;

  const pageNumbers = useMemo(
    () => Array.from({ length: paginated.totalPages }, (_, idx) => idx + 1),
    [paginated.totalPages]
  );

  const handleSuggestSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateProjectDescription(projectDraft);
    if (!validation.ok) {
      setAiError(validation.error ?? 'Describe your project in 10 to 500 characters.');
      setAiStatusNote('');
      projectInputRef.current?.focus();
      return;
    }

    setAiError('');
    setAiLoading(true);
    setAiStatusNote('Finding matching campus equipment...');

    try {
      const result = await suggestEquipment(validation.cleaned);
      setAiSuggestions(result.suggestions);
      setAiSource(result.source);
      setAiStatusNote(
        result.suggestions.length > 0
          ? `Found ${result.suggestions.length} equipment match${result.suggestions.length === 1 ? '' : 'es'} (${formatAiSourceLabel(result.source)}).`
          : 'No catalog matches returned for that project description.'
      );
    } catch (err) {
      setAiSuggestions([]);
      setAiSource(null);
      setAiError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to fetch equipment suggestions right now.'
      );
      setAiStatusNote('');
    } finally {
      setAiLoading(false);
    }
  };

  const handleClearSuggestions = () => {
    setProjectDraft('');
    setAiError('');
    setAiSuggestions([]);
    setAiSource(null);
    setAiStatusNote('');
  };

  const resolvedSuggestions = useMemo(
    () =>
      aiSuggestions
        .map((suggestion) => ({
          suggestion,
          item: getItemById(suggestion.itemId),
        }))
        .filter(
          (
            entry
          ): entry is {
            suggestion: EquipmentSuggestion;
            item: NonNullable<ReturnType<typeof getItemById>>;
          } => Boolean(entry.item)
        ),
    [aiSuggestions, dataVersion]
  );

  // If the currently viewed lab or subject was deleted by faculty admin, show a friendly recovery state.
  if ((filters.labId && !activeLab) || (filters.departmentId && !activeDepartment)) {
    return (
      <section className="notebook-sheet p-8 text-center">
        <HeroBenchDoodle className="mx-auto mb-4 h-36 w-auto" />
        <h1 className="text-3xl font-bold text-[var(--ink)]">
          Laboratory or subject no longer listed
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-base text-[var(--ink)]">
          This laboratory or subject was removed from the campus catalog. Return to Discover to browse active labs and instruments.
        </p>
        <a
          href="#discover"
          onClick={(e) => {
            e.preventDefault();
            setSearchDraft('');
            onClearFilters();
          }}
          className="labora-btn mt-5"
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
          Back to Discover
        </a>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header & Active Lab Context */}
      <section className="notebook-sheet p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">
              {activeLab
                ? activeLab.name
                : activeDepartment
                  ? `${activeDepartment.name} Laboratories`
                  : 'Discover Campus Equipment'}
            </h1>
            <p className="mt-1.5 max-w-2xl text-base text-[var(--ink)]">
              {activeLab
                ? `${activeLab.description} Room ${activeLab.room} · Supervised by ${activeLab.supervisor} · Hours ${activeLab.hours}.`
                : activeDepartment
                  ? `${activeDepartment.summary} Located in ${activeDepartment.building}, lead faculty ${activeDepartment.leadFaculty}.`
                  : 'Filter instruments, development kits, workstations, and safety gear across all seven departments.'}
            </p>
          </div>

          <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-4 py-2 text-center text-[var(--on-lavender)]">
            <p
              aria-live="polite"
              aria-atomic="true"
              className="font-heading text-2xl font-bold tabular-nums !text-[var(--on-lavender)] leading-tight"
            >
              {countLabel}
            </p>
            {paginated.totalPages > 1 && (
              <p className="text-sm tabular-nums text-[var(--on-lavender)]">
                Page {paginated.page} of {paginated.totalPages}
              </p>
            )}
          </div>
        </div>

        {/* Search & Filter Controls — every control has a visible label */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t-2 border-dashed border-[var(--border-subtle)] pt-5 sm:grid-cols-2 xl:grid-cols-5">
          <div className="sm:col-span-2 xl:col-span-1">
            <label
              htmlFor="discover-search"
              className="mb-1 block text-sm font-bold text-[var(--ink)]"
            >
              Search
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink)]"
                aria-hidden="true"
              />
              <input
                id="discover-search"
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Name, lab, dept, specs..."
                className="notebook-input !pl-9"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="discover-dept"
              className="mb-1 block text-sm font-bold text-[var(--ink)]"
            >
              Department
            </label>
            <select
              id="discover-dept"
              value={filters.departmentId}
              onChange={(e) =>
                onUpdateFilters({ departmentId: e.target.value, labId: '' })
              }
              className="notebook-input"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="discover-lab"
              className="mb-1 block text-sm font-bold text-[var(--ink)]"
            >
              Laboratory
            </label>
            <select
              id="discover-lab"
              value={filters.labId}
              onChange={(e) => {
                const selectedLab = labMap.get(e.target.value);
                onUpdateFilters({
                  departmentId: selectedLab
                    ? selectedLab.departmentId
                    : filters.departmentId,
                  labId: e.target.value,
                });
              }}
              className="notebook-input"
            >
              <option value="">All Laboratories</option>
              {scopedLabs.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.name} ({lab.room})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="discover-type"
              className="mb-1 block text-sm font-bold text-[var(--ink)]"
            >
              Equipment type
            </label>
            <select
              id="discover-type"
              value={filters.type}
              onChange={(e) =>
                onUpdateFilters({ type: e.target.value as EquipmentType | '' })
              }
              className="notebook-input"
            >
              <option value="">All Types</option>
              {EQUIPMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="discover-status"
              className="mb-1 block text-sm font-bold text-[var(--ink)]"
            >
              Availability
            </label>
            <select
              id="discover-status"
              value={filters.status}
              onChange={(e) =>
                onUpdateFilters({
                  status: e.target.value as AvailabilityStatus | '',
                })
              }
              className="notebook-input"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Access Level Filter with visible label & Clear Filters Action */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span
              id="discover-access-label"
              className="mb-1 block text-sm font-bold text-[var(--ink)]"
            >
              Access level
            </span>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-labelledby="discover-access-label"
            >
              <button
                type="button"
                onClick={() => onUpdateFilters({ accessLevel: '' })}
                aria-pressed={filters.accessLevel === ''}
                className={`labora-btn text-sm ${
                  filters.accessLevel === '' ? '' : 'labora-btn-paper'
                }`}
              >
                Any Access
              </button>
              {ACCESS_OPTIONS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onUpdateFilters({ accessLevel: level })}
                  aria-pressed={filters.accessLevel === level}
                  className={`labora-btn text-sm ${
                    filters.accessLevel === level ? '' : 'labora-btn-paper'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchDraft('');
              onClearFilters();
            }}
            disabled={!hasFilters}
            className="labora-btn labora-btn-paper text-sm"
          >
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
            Clear filters
          </button>
        </div>
      </section>

      {/* Project-Based Equipment Suggestions */}
      <section
        aria-labelledby="discover-project-finder-heading"
        className="notebook-sheet notebook-sheet-alt-tape p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="discover-project-finder-heading"
              className="flex items-center gap-2 text-2xl font-bold text-[var(--ink)] sm:text-3xl"
            >
              <Sparkles className="h-5 w-5 shrink-0 text-[var(--ink)]" aria-hidden="true" />
              Tell me about your project
            </h2>
            <p className="mt-1 text-base text-[var(--ink)]">
              Describe what you are building or testing to get recommended campus instruments from the catalog.
            </p>
          </div>

          {aiSource && resolvedSuggestions.length > 0 && (
            <span className="status-badge bg-[var(--lavender)] !text-[var(--on-lavender)] text-sm">
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{formatAiSourceLabel(aiSource)}</span>
            </span>
          )}
        </div>

        <form onSubmit={handleSuggestSubmit} className="mt-4 space-y-3" noValidate>
          <div>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <label
                htmlFor="discover-project-input"
                className="text-sm font-bold text-[var(--ink)]"
              >
                Project description (required, 10 to 500 characters)
              </label>
              <span className="text-xs tabular-nums text-[var(--ink)]">
                {projectDraft.trim().length} / 500 chars
              </span>
            </div>
            <textarea
              ref={projectInputRef}
              id="discover-project-input"
              rows={3}
              maxLength={500}
              value={projectDraft}
              onChange={(e) => {
                setProjectDraft(e.target.value);
                if (aiError) setAiError('');
              }}
              aria-required="true"
              aria-invalid={Boolean(aiError)}
              aria-describedby={
                aiError ? 'discover-project-error discover-project-privacy' : 'discover-project-privacy'
              }
              placeholder="Example: Measure frequency response of an active bandpass filter and test SMD solder joints."
              className="notebook-input min-h-[88px] resize-y"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[var(--ink)]">Examples:</span>
            {PROJECT_EXAMPLES.map((example, idx) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setProjectDraft(example);
                  setAiError('');
                }}
                className="labora-btn labora-btn-paper !px-3 !py-1 text-xs"
              >
                Example {idx + 1}
              </button>
            ))}
          </div>

          {aiError && (
            <p
              id="discover-project-error"
              role="alert"
              className="rounded-[8px] border-2 border-[var(--ink)] bg-[var(--status-booked-bg)] px-3 py-2 text-sm font-bold text-[var(--ink)]"
            >
              {aiError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p id="discover-project-privacy" className="text-sm text-[var(--ink)]">
              Only your project text and the equipment catalog are sent to the AI.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {(projectDraft.trim() || aiSuggestions.length > 0 || aiError) && (
                <button
                  type="button"
                  onClick={handleClearSuggestions}
                  className="labora-btn labora-btn-paper text-sm"
                >
                  <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Clear suggestions
                </button>
              )}
              <button
                type="submit"
                disabled={aiLoading}
                aria-busy={aiLoading}
                className="labora-btn text-sm"
              >
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                {aiLoading ? 'Matching equipment...' : 'Suggest equipment'}
              </button>
            </div>
          </div>
        </form>

        <div
          aria-live="polite"
          className={
            aiStatusNote
              ? 'mt-4 rounded-[8px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2 text-sm font-bold text-[var(--ink)]'
              : 'sr-only'
          }
        >
          {aiStatusNote}
        </div>

        {resolvedSuggestions.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {resolvedSuggestions.map(({ suggestion, item }) => (
              <div key={item.id} className="flex flex-col gap-2">
                <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--lavender-soft)] px-3.5 py-2 text-sm text-[var(--ink)]">
                  <strong>Why it fits:</strong> {suggestion.reason}
                </div>
                <EquipmentCard
                  item={item}
                  departmentName={departmentMap.get(item.departmentId)?.name}
                  labName={labMap.get(item.labId)?.name}
                  onBookItem={(itemId) => onNavigate('booking', { itemId })}
                  onInspectItem={onInspectItem}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reusable Equipment Card Grid or Friendly Empty State */}
      {paginated.items.length > 0 ? (
        <>
          <section
            aria-label="Equipment catalog results"
            className="results-grid-stable perf-section grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {paginated.items.map((item) => (
              <EquipmentCard
                key={item.id}
                item={item}
                departmentName={departmentMap.get(item.departmentId)?.name}
                labName={labMap.get(item.labId)?.name}
                onBookItem={(itemId) => onNavigate('booking', { itemId })}
                onInspectItem={onInspectItem}
              />
            ))}
          </section>

          {/* Keyboard-accessible Pagination (9 items per page) */}
          {paginated.totalPages > 1 && (
            <nav
              aria-label="Catalog pagination"
              className="notebook-sheet flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <button
                type="button"
                onClick={() => onChangePage(paginated.page - 1)}
                disabled={paginated.page <= 1}
                className="labora-btn labora-btn-paper text-sm"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                Previous
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {pageNumbers.map((pageNum) => {
                  const isCurrent = pageNum === paginated.page;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => onChangePage(pageNum)}
                      aria-label={`Page ${pageNum}`}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={`labora-btn !min-w-[44px] !px-3 text-sm tabular-nums ${
                        isCurrent ? '' : 'labora-btn-paper'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onChangePage(paginated.page + 1)}
                disabled={paginated.page >= paginated.totalPages}
                className="labora-btn labora-btn-paper text-sm"
              >
                Next
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      ) : (
        <section className="notebook-sheet p-8 text-center">
          <HeroBenchDoodle className="mx-auto mb-4 h-36 w-auto" />
          <h2 className="text-2xl font-bold text-[var(--ink)]">
            No matching lab equipment found
          </h2>
          <p className="mt-1.5 text-base text-[var(--ink)]">
            Try clearing your search or filters, or pick another department from the Lab Index.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchDraft('');
              onClearFilters();
            }}
            className="labora-btn mt-5"
          >
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
            Clear filters
          </button>
        </section>
      )}
    </div>
  );
}
