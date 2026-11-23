/**
 * AI-assisted project-to-equipment finder panel with deterministic fallback badges.
 */
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import {
  formatAiSourceLabel,
  suggestEquipment,
  validateProjectDescription,
  type AiSource,
  type EquipmentSuggestion,
} from '../js/ai-client';
import { LIMITS } from '../js/constants';
import { getItemById } from '../js/lab-data';
import type { Department, Lab } from '../js/types';
import { EquipmentCard, type PageId } from './EquipmentCard';

const PROJECT_EXAMPLES = [
  'Measure frequency response and filter ripple on a 20 MHz analog circuit prototype.',
  'Fabricate a microfluidic PDMS chip and inspect channel alignment under magnification.',
  'Train a lightweight computer vision model and deploy real-time inference on an edge board.',
];

interface AiEquipmentFinderProps {
  dataVersion: number;
  departmentMap: Map<string, Department>;
  labMap: Map<string, Lab>;
  onNavigate: (page: PageId, options?: { itemId?: string }) => void;
  onInspectItem: (itemId: string, trigger?: HTMLButtonElement | null) => void;
}

/**
 * Renders the "Tell me about your project" natural-language equipment suggestion panel.
 *
 * @param props - Catalog maps, store version, and card interaction callbacks.
 * @returns Project finder section element.
 */
export function AiEquipmentFinder({
  dataVersion,
  departmentMap,
  labMap,
  onNavigate,
  onInspectItem,
}: AiEquipmentFinderProps) {
  const [projectDraft, setProjectDraft] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<EquipmentSuggestion[]>([]);
  const [aiSource, setAiSource] = useState<AiSource | null>(null);
  const [aiStatusNote, setAiStatusNote] = useState('');
  const projectInputRef = useRef<HTMLTextAreaElement | null>(null);

  const resolvedSuggestions = useMemo(
    () =>
      aiSuggestions
        .map((suggestion) => ({ suggestion, item: getItemById(suggestion.itemId) }))
        .filter(
          (entry): entry is { suggestion: EquipmentSuggestion; item: NonNullable<ReturnType<typeof getItemById>> } =>
            Boolean(entry.item)
        ),
    [aiSuggestions, dataVersion]
  );

  const handleSuggestSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateProjectDescription(projectDraft);
    if (!validation.ok) {
      setAiError(validation.error ?? `Describe your project in ${LIMITS.AI_PROJECT_MIN} to ${LIMITS.AI_PROJECT_MAX} characters.`);
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
      setAiError(err instanceof Error && err.message ? err.message : 'Unable to fetch equipment suggestions right now.');
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

  return (
    <section aria-labelledby="discover-project-finder-heading" className="notebook-sheet notebook-sheet-alt-tape p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="discover-project-finder-heading" className="flex items-center gap-2 text-2xl font-bold text-[var(--ink)] sm:text-3xl">
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
            <label htmlFor="discover-project-input" className="text-sm font-bold text-[var(--ink)]">
              Project description (required, {LIMITS.AI_PROJECT_MIN} to {LIMITS.AI_PROJECT_MAX} characters)
            </label>
            <span className="text-xs tabular-nums text-[var(--ink)]">
              {projectDraft.trim().length} / {LIMITS.AI_PROJECT_MAX} chars
            </span>
          </div>
          <textarea
            ref={projectInputRef}
            id="discover-project-input"
            rows={3}
            maxLength={LIMITS.AI_PROJECT_MAX}
            value={projectDraft}
            onChange={(e) => {
              setProjectDraft(e.target.value);
              if (aiError) setAiError('');
            }}
            aria-required="true"
            aria-invalid={Boolean(aiError)}
            aria-describedby={aiError ? 'discover-project-error discover-project-privacy' : 'discover-project-privacy'}
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
          <p id="discover-project-error" role="alert" className="rounded-[8px] border-2 border-[var(--ink)] bg-[var(--status-booked-bg)] px-3 py-2 text-sm font-bold text-[var(--ink)]">
            {aiError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p id="discover-project-privacy" className="text-sm text-[var(--ink)]">
            Only your project text and the equipment catalog are sent to the AI.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {(projectDraft.trim() || aiSuggestions.length > 0 || aiError) && (
              <button type="button" onClick={handleClearSuggestions} className="labora-btn labora-btn-paper text-sm">
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                Clear suggestions
              </button>
            )}
            <button type="submit" disabled={aiLoading} aria-busy={aiLoading} className="labora-btn text-sm">
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
  );
}
