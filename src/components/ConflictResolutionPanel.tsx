/**
 * Conflict resolution panel showing competing requests, deterministic fair-allocation scores, AI plain-words explanation, and alternative recommendations.
 */
import { AlertTriangle, Calendar, CheckCircle2, MessageSquareText, Sparkles, XCircle } from 'lucide-react';
import { formatAiSourceLabel, type AiSource } from '../js/ai-client';
import type { AllocationResult, ConflictGroup } from '../js/scheduler';

interface ConflictResolutionPanelProps {
  conflict: ConflictGroup;
  allocationResult: AllocationResult;
  allocationExplanation: string;
  plainExplanation: { text: string; source: AiSource } | null;
  explainLoading: boolean;
  explainError: string;
  onExplainPlainWords: () => void;
  onSelectItem: (itemId: string) => void;
  onAcceptSuggestion: () => void;
  onPickAnotherSlot: () => void;
}

function RankedScoreCard({
  entry,
  rankIndex,
  isFeasible,
  assignment,
}: {
  entry: AllocationResult['ranked'][number];
  rankIndex: number;
  isFeasible: boolean;
  assignment?: AllocationResult['assignments'][number];
}) {
  return (
    <li className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--white)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-lg font-bold text-[var(--ink)]">
          #{rankIndex + 1} · {entry.request.student}
          <span className="ml-2 rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-2 py-0.5 text-sm tabular-nums text-[var(--on-lavender)]">
            {entry.score} / 100
          </span>
        </div>
        <span className={isFeasible ? 'status-badge status-badge-available text-sm' : 'status-badge status-badge-booked text-sm'}>
          {isFeasible ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>Feasible before deadline: {isFeasible ? 'Yes' : 'No'}</span>
        </span>
      </div>
      {assignment && (
        <p className="mt-1.5 text-sm font-bold text-[var(--ink)] tabular-nums">
          Suggested window: {assignment.date} · {assignment.start}–{assignment.end}
          {assignment.isContestedSlot ? ' (contested slot)' : ' (earliest free slot)'}
        </p>
      )}
      <div className="mt-2 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
        {entry.breakdown.map((factor) => (
          <div key={factor.factor} className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--paper)] px-2.5 py-1.5">
            <div className="flex items-center justify-between font-bold tabular-nums">
              <span>{factor.factor}</span>
              <span>
                {factor.points}/{factor.maxPoints}
              </span>
            </div>
            <div className="text-xs text-[var(--ink)]">{factor.reason}</div>
          </div>
        ))}
      </div>
    </li>
  );
}

/**
 * Renders competing request details alongside the deterministic fair-allocation recommendation.
 *
 * @param props - Conflict group, deterministic allocation outcome, AI explanation state, and actions.
 * @returns Conflict resolution grid section.
 */
export function ConflictResolutionPanel({
  conflict,
  allocationResult,
  allocationExplanation,
  plainExplanation,
  explainLoading,
  explainError,
  onExplainPlainWords,
  onSelectItem,
  onAcceptSuggestion,
  onPickAnotherSlot,
}: ConflictResolutionPanelProps) {
  return (
    <section aria-labelledby="conflict-panel-heading" className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="notebook-sheet notebook-sheet-alt-tape p-5 xl:col-span-5">
        <div className="flex items-center gap-2 border-b-2 border-[var(--ink)] pb-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--ink)]" aria-hidden="true" />
          <h2 id="conflict-panel-heading" className="text-2xl font-bold text-[var(--ink)]">
            Competing Requests Detected
          </h2>
        </div>
        <p className="mt-2.5 text-base text-[var(--ink)]">
          Contested window:{' '}
          <strong className="tabular-nums">
            {conflict.date} · {conflict.start}–{conflict.end}
          </strong>
        </p>
        <ul className="mt-4 space-y-3">
          {conflict.requests.map((req) => (
            <li key={req.id} className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold text-[var(--ink)]">{req.student}</span>
                <span className="status-badge status-badge-limited text-sm">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Conflict</span>
                </span>
              </div>
              <div className="mt-1 text-base font-bold text-[var(--ink)]">{req.project}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-[var(--ink)]">
                <span>Deadline: {req.deadline}</span>
                <span>Hours: {req.hoursNeeded}h</span>
                <span>Team: {req.teamSize}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="notebook-sheet p-5 xl:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--ink)] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-[var(--ink)]" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-[var(--ink)]">Fair-Allocation Recommendation</h2>
          </div>
          <span className="rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-2.5 py-0.5 text-sm font-bold text-[var(--on-lavender)]">
            Deterministic Priority Score
          </span>
        </div>

        <p className="mt-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-3.5 text-base text-[var(--ink)]">
          {allocationExplanation}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={onExplainPlainWords} disabled={explainLoading} aria-busy={explainLoading} className="labora-btn labora-btn-paper text-sm">
            <MessageSquareText className="h-4 w-4 shrink-0" aria-hidden="true" />
            {explainLoading ? 'Writing plain summary...' : 'Explain in plain words'}
          </button>
          <span className="text-xs text-[var(--ink)]">Only your project text and the equipment catalog are sent to the AI.</span>
        </div>

        <div aria-live="polite" className="mt-2">
          {explainError && (
            <p role="alert" className="rounded-[8px] border-2 border-[var(--ink)] bg-[var(--status-booked-bg)] px-3 py-2 text-sm font-bold text-[var(--ink)]">
              {explainError}
            </p>
          )}
          {plainExplanation && (
            <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--lavender-soft)] p-3.5 text-base text-[var(--ink)]">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold">Plain-language summary</span>
                <span className="status-badge bg-[var(--lavender)] !text-[var(--on-lavender)] text-xs">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{formatAiSourceLabel(plainExplanation.source)}</span>
                </span>
              </div>
              <p>{plainExplanation.text}</p>
            </div>
          )}
        </div>

        <ul className="mt-4 space-y-3">
          {allocationResult.ranked.map((entry, idx) => (
            <RankedScoreCard
              key={entry.request.id}
              entry={entry}
              rankIndex={idx}
              isFeasible={allocationResult.feasible[entry.request.id]}
              assignment={allocationResult.assignments.find((a) => a.requestId === entry.request.id)}
            />
          ))}
        </ul>

        {allocationResult.alternatives.length > 0 && (
          <div className="mt-4 space-y-2">
            {allocationResult.alternatives.map((alt) => (
              <div
                key={alt.requestId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--lavender-soft)] p-3.5 text-sm text-[var(--ink)]"
              >
                <div>
                  <div className="font-bold">
                    Alternative Equipment for {alt.student}: {alt.suggestedItemName}
                  </div>
                  <div>{alt.reason}</div>
                </div>
                <button type="button" onClick={() => onSelectItem(alt.suggestedItemId)} className="labora-btn labora-btn-paper text-sm">
                  Inspect Alternative
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onAcceptSuggestion} className="labora-btn">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Accept suggestion
          </button>
          <button type="button" onClick={onPickAnotherSlot} className="labora-btn labora-btn-paper">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            Pick another slot
          </button>
        </div>
      </div>
    </section>
  );
}
