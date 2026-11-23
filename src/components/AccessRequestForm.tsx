/**
 * Project access request form component handling validation, refs, and submission state.
 */
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { LAB_SCHEDULE } from '../js/constants';
import { submitAccessRequest } from '../js/lab-data';
import { validateRequest, type RequestFieldKey } from '../js/requests';
import type { CampusUser, Department, EquipmentItem, Lab } from '../js/types';
import {
  EquipmentMultiSelect,
  type GroupedDepartmentCatalog,
} from './EquipmentMultiSelect';
import { RequestHeaderFields } from './RequestFormSections';
import {
  JustificationAndTrainingSection,
  RequestScheduleMetricsRow,
  type RequestFormRefs,
} from './RequestScheduleSection';

interface AccessRequestFormProps {
  currentUser: CampusUser;
  departments: Department[];
  labs: Lab[];
  allItems: EquipmentItem[];
  initialItem?: EquipmentItem;
  liveMessage: string;
  onLiveMessage: (message: string) => void;
  onDataMutated: () => void;
}

function buildGroupedCatalog(
  departments: Department[],
  labs: Lab[],
  allItems: EquipmentItem[],
  query: string
): GroupedDepartmentCatalog[] {
  const normalizedQuery = query.trim().toLowerCase();
  return departments
    .map((dept) => {
      const deptLabs = labs
        .filter((lab) => lab.departmentId === dept.id)
        .map((lab) => ({
          lab,
          items: allItems.filter((item) => {
            if (item.labId !== lab.id) return false;
            if (!normalizedQuery) return true;
            const haystack = `${item.name} ${item.type} ${item.accessLevel} ${dept.name} ${lab.name}`.toLowerCase();
            return haystack.includes(normalizedQuery);
          }),
        }))
        .filter((group) => group.items.length > 0);
      return { dept, labs: deptLabs };
    })
    .filter((group) => group.labs.length > 0);
}

/**
 * Renders the lab access request submission form with validation and live announcements.
 *
 * @param props - User context, catalog datasets, initial selection, and submission callbacks.
 * @returns Notebook section containing the access request form.
 */
export function AccessRequestForm({
  currentUser,
  departments,
  labs,
  allItems,
  initialItem,
  liveMessage,
  onLiveMessage,
  onDataMutated,
}: AccessRequestFormProps) {
  const [project, setProject] = useState('');
  const [subjectCourse, setSubjectCourse] = useState('');
  const [departmentId, setDepartmentId] = useState(
    initialItem?.departmentId ?? departments[0]?.id ?? ''
  );
  const [teamSize, setTeamSize] = useState(2);
  const [deadline, setDeadline] = useState('2026-12-10');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(
    initialItem ? [initialItem.id] : []
  );
  const [equipmentQuery, setEquipmentQuery] = useState('');
  const [hoursNeeded, setHoursNeeded] = useState(6);
  const [justification, setJustification] = useState('');
  const [trainingConfirmed, setTrainingConfirmed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RequestFieldKey, string>>>({});

  const refs: RequestFormRefs = {
    project: useRef<HTMLInputElement | null>(null),
    subjectCourse: useRef<HTMLInputElement | null>(null),
    departmentId: useRef<HTMLSelectElement | null>(null),
    teamSize: useRef<HTMLInputElement | null>(null),
    deadline: useRef<HTMLInputElement | null>(null),
    itemIds: useRef<HTMLInputElement | null>(null),
    hoursNeeded: useRef<HTMLInputElement | null>(null),
    justification: useRef<HTMLTextAreaElement | null>(null),
    trainingConfirmed: useRef<HTMLInputElement | null>(null),
  };

  const itemMap = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);
  const validSelectedIds = selectedItemIds.filter((id) => itemMap.has(id));
  const selectedItems = validSelectedIds
    .map((id) => itemMap.get(id))
    .filter((item): item is EquipmentItem => Boolean(item));
  const requiresTraining = selectedItems.some((item) => item.accessLevel === 'Training required');

  const groupedCatalog = useMemo(
    () => buildGroupedCatalog(departments, labs, allItems, equipmentQuery),
    [departments, labs, allItems, equipmentQuery]
  );

  const toggleEquipmentItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]
    );
    setFieldErrors((prev) => {
      if (!prev.itemIds && !prev.trainingConfirmed) return prev;
      const next = { ...prev };
      delete next.itemIds;
      delete next.trainingConfirmed;
      return next;
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onLiveMessage('');
    const payload = {
      project,
      subjectCourse,
      departmentId,
      teamSize,
      deadline,
      itemIds: validSelectedIds,
      hoursNeeded,
      justification,
      trainingConfirmed,
    };
    const validation = validateRequest(payload, {
      departments,
      items: allItems,
      referenceDate: LAB_SCHEDULE.DEFAULT_REFERENCE_DATE,
    });
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      const firstError = validation.errors[0];
      if (firstError) refs[firstError.field].current?.focus();
      return;
    }
    const created = submitAccessRequest(payload);
    if (!created) return;
    setFieldErrors({});
    setProject('');
    setSubjectCourse('');
    setEquipmentQuery('');
    setSelectedItemIds([]);
    setTeamSize(2);
    setHoursNeeded(6);
    setJustification('');
    setTrainingConfirmed(false);
    onLiveMessage(
      `Access request ${created.id} submitted for ${created.equipmentNeeded}. Status: Submitted.`
    );
    onDataMutated();
  };

  return (
    <section className="notebook-sheet p-6 xl:col-span-6">
      <h1 className="text-3xl font-bold text-[var(--ink)]">Request Lab Access</h1>
      <p className="mt-1 text-base text-[var(--ink)]">
        Apply for faculty clearance or safety-certified bench access. Approved items unlock immediately in Smart Booking.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        <RequestHeaderFields
          currentUser={currentUser}
          project={project}
          subjectCourse={subjectCourse}
          departmentId={departmentId}
          departments={departments}
          fieldErrors={fieldErrors}
          refs={refs}
          onProjectChange={setProject}
          onSubjectChange={setSubjectCourse}
          onDepartmentChange={setDepartmentId}
        />
        <RequestScheduleMetricsRow
          teamSize={teamSize}
          deadline={deadline}
          hoursNeeded={hoursNeeded}
          fieldErrors={fieldErrors}
          refs={refs}
          onTeamSizeChange={setTeamSize}
          onDeadlineChange={setDeadline}
          onHoursChange={setHoursNeeded}
        />
        <EquipmentMultiSelect
          groupedCatalog={groupedCatalog}
          selectedItems={selectedItems}
          selectedItemIds={selectedItemIds}
          equipmentQuery={equipmentQuery}
          searchRef={refs.itemIds}
          error={fieldErrors.itemIds}
          onQueryChange={setEquipmentQuery}
          onToggleItem={toggleEquipmentItem}
        />
        <JustificationAndTrainingSection
          justification={justification}
          trainingConfirmed={trainingConfirmed}
          requiresTraining={requiresTraining}
          fieldErrors={fieldErrors}
          refs={refs}
          onJustificationChange={setJustification}
          onTrainingChange={setTrainingConfirmed}
        />

        <div aria-live="polite" className="min-h-[1.5rem]">
          {liveMessage && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--status-available-bg)] px-3 py-2.5 text-base font-bold text-[var(--ink)]"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{liveMessage}</span>
            </div>
          )}
        </div>

        <button type="submit" className="labora-btn w-full">
          <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          Submit Access Request
        </button>
      </form>
    </section>
  );
}
