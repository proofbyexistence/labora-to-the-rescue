/**
 * Faculty analytics sidebar displaying conflict queue, SVG lab utilization bars, and underused items.
 */
import { ArrowRight, Compass } from 'lucide-react';
import type { LabUtilizationStat, UnderusedItemStat } from '../js/analytics';
import type { AppPageId } from '../js/filter';
import type { ConflictGroup } from '../js/scheduler';
import type { EquipmentItem } from '../js/types';

interface FacultyAnalyticsSidebarProps {
  openConflicts: ConflictGroup[];
  itemMap: Map<string, EquipmentItem>;
  labCount: number;
  overallUtilizationPct: number;
  labUtilizations: LabUtilizationStat[];
  underusedItems: UnderusedItemStat[];
  onNavigate: (
    page: AppPageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => void;
}

function ConflictQueueSection({
  openConflicts,
  itemMap,
  onNavigate,
}: {
  openConflicts: ConflictGroup[];
  itemMap: Map<string, EquipmentItem>;
  onNavigate: FacultyAnalyticsSidebarProps['onNavigate'];
}) {
  return (
    <section className="notebook-sheet p-5">
      <h2 className="text-2xl font-bold text-[var(--ink)]">Conflict queue</h2>
      <p className="mt-0.5 text-sm text-[var(--ink)]">
        Competing requests awaiting Smart Booking fair allocation
      </p>

      {openConflicts.length === 0 ? (
        <p className="mt-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--status-available-bg)] px-3 py-2 text-sm font-bold text-[var(--ink)]">
          All competing windows are currently resolved.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {openConflicts.map((conflict) => {
            const item = itemMap.get(conflict.itemId);
            return (
              <li
                key={`${conflict.itemId}-${conflict.date}-${conflict.start}`}
                className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-3"
              >
                <div className="font-bold text-[var(--ink)]">{item?.name ?? conflict.itemId}</div>
                <div className="mt-0.5 tabular-nums text-sm text-[var(--ink)]">
                  {conflict.date} · {conflict.start}–{conflict.end} ({conflict.requests.length} requests)
                </div>
                <div className="mt-1 text-sm text-[var(--ink)]">
                  {conflict.requests.map((r) => r.student).join(' vs. ')}
                </div>
                <a
                  href={`#booking&item=${encodeURIComponent(conflict.itemId)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('booking', { itemId: conflict.itemId });
                  }}
                  className="labora-btn mt-2.5 text-sm"
                >
                  <span>Resolve in Smart Booking</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LabUtilizationChartSection({
  labCount,
  overallUtilizationPct,
  labUtilizations,
}: {
  labCount: number;
  overallUtilizationPct: number;
  labUtilizations: LabUtilizationStat[];
}) {
  return (
    <section className="notebook-sheet notebook-sheet-alt-tape chart-panel-stable p-5">
      <h2 className="text-2xl font-bold text-[var(--ink)]">Utilization by lab</h2>
      <p className="mt-0.5 text-sm text-[var(--ink)]">
        Booked hours vs. scheduled capacity across all {labCount} campus labs
      </p>
      <p className="sr-only">
        Lab utilization summary: overall utilization {overallUtilizationPct}% across {labCount} laboratories.{' '}
        {labUtilizations
          .map(
            (stat) =>
              `${stat.labName} (${stat.room}): ${stat.utilizationPct}% (${stat.bookedHours} of ${stat.capacityHours} hours)`
          )
          .join('; ')}
        .
      </p>

      <ul className="mt-4 space-y-2.5">
        {labUtilizations.map((stat) => {
          const barWidth = Math.max(4, stat.utilizationPct * 2);
          return (
            <li key={stat.labId} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm text-[var(--ink)]">
                <span className="truncate font-bold">
                  {stat.labName} ({stat.room})
                </span>
                <span className="tabular-nums font-bold shrink-0">
                  {stat.bookedHours}h/{stat.capacityHours}h · {stat.utilizationPct}%
                </span>
              </div>
              <svg
                width={200}
                height={14}
                viewBox="0 0 200 14"
                role="img"
                focusable="false"
                aria-label={`${stat.labName} utilization: ${stat.utilizationPct}% (${stat.bookedHours} of ${stat.capacityHours} hours)`}
                className="block h-3.5 w-full overflow-visible"
              >
                <rect
                  x="1"
                  y="1"
                  width="198"
                  height="12"
                  rx="5"
                  fill="var(--paper)"
                  stroke="var(--ink)"
                  strokeWidth="2"
                />
                {stat.utilizationPct > 0 && (
                  <rect
                    x="2"
                    y="2"
                    width={Math.min(196, barWidth)}
                    height="10"
                    rx="4"
                    fill="var(--lavender)"
                    stroke="var(--ink)"
                    strokeWidth="1.5"
                  />
                )}
              </svg>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function UnderusedEquipmentSection({
  underusedItems,
  onNavigate,
}: {
  underusedItems: UnderusedItemStat[];
  onNavigate: FacultyAnalyticsSidebarProps['onNavigate'];
}) {
  return (
    <section className="notebook-sheet p-5">
      <h2 className="text-2xl font-bold text-[var(--ink)]">Underused equipment</h2>
      <p className="mt-0.5 text-sm text-[var(--ink)]">
        Lowest-utilization instruments — consider highlighting these on Discover to balance campus demand.
      </p>

      <ul className="mt-3 space-y-2.5">
        {underusedItems.map((entry) => (
          <li
            key={entry.item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-[var(--ink)]">{entry.item.name}</div>
              <div className="text-xs text-[var(--ink)]">
                {entry.item.location} ·{' '}
                <span className="tabular-nums font-bold">
                  {entry.utilizationPct}% utilized ({entry.bookedHours}h / {entry.capacityHours}h)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onNavigate('discover', {
                  departmentId: entry.item.departmentId,
                  labId: entry.item.labId,
                })
              }
              className="labora-btn labora-btn-paper text-xs"
            >
              <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              View on Discover
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Renders the faculty analytics sidebar covering conflict queues, utilization charts, and underused items.
 *
 * @param props - Conflict detections, lab utilization stats, underused items, and navigation handler.
 * @returns Sidebar column element for Faculty Approvals.
 */
export function FacultyAnalyticsSidebar({
  openConflicts,
  itemMap,
  labCount,
  overallUtilizationPct,
  labUtilizations,
  underusedItems,
  onNavigate,
}: FacultyAnalyticsSidebarProps) {
  return (
    <aside aria-label="Lab utilization and conflict analytics" className="space-y-5 xl:col-span-5">
      <ConflictQueueSection
        openConflicts={openConflicts}
        itemMap={itemMap}
        onNavigate={onNavigate}
      />
      <LabUtilizationChartSection
        labCount={labCount}
        overallUtilizationPct={overallUtilizationPct}
        labUtilizations={labUtilizations}
      />
      <UnderusedEquipmentSection underusedItems={underusedItems} onNavigate={onNavigate} />
    </aside>
  );
}
