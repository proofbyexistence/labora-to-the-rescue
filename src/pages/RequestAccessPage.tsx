import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSearch,
  RefreshCw,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import type { PageId } from '../components/EquipmentCard';
import { HeroBenchDoodle } from '../components/LabDoodles';
import {
  getDepartments,
  getItems,
  getLabs,
  getRequests,
  getStateVersion,
  submitAccessRequest,
  transitionAccessRequest,
} from '../js/labData';
import {
  validateRequest,
  type RequestFieldKey,
} from '../js/requests';
import { DEFAULT_REFERENCE_DATE } from '../js/scheduler';
import type { CampusUser, EquipmentItem, RequestStatus } from '../js/types';

interface RequestAccessPageProps {
  selectedItemId: string;
  currentUser: CampusUser;
  onNavigate: (
    page: PageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => void;
  onDataMutated: () => void;
}

const REQUEST_STATUS_META: Record<
  RequestStatus,
  { className: string; Icon: typeof CheckCircle2 }
> = {
  Submitted: { className: 'status-badge status-badge-limited', Icon: Clock },
  'Under review': {
    className: 'status-badge status-badge-limited',
    Icon: FileSearch,
  },
  'Changes requested': {
    className: 'status-badge status-badge-limited',
    Icon: AlertTriangle,
  },
  Approved: {
    className: 'status-badge status-badge-available',
    Icon: CheckCircle2,
  },
  Rejected: { className: 'status-badge status-badge-booked', Icon: XCircle },
};

const STEPPER_STAGES: RequestStatus[] = ['Submitted', 'Under review', 'Approved'];

function getStageIndex(status: RequestStatus): number {
  if (status === 'Submitted') return 0;
  if (status === 'Under review' || status === 'Changes requested') return 1;
  return 2;
}

export function RequestAccessPage({
  selectedItemId,
  currentUser,
  onNavigate,
  onDataMutated,
}: RequestAccessPageProps) {
  const dataVersion = getStateVersion();

  const { allItems, departments, labs, deptMap, itemMap, allRequests } = useMemo(() => {
    const items = getItems();
    const depts = getDepartments();
    const allLabs = getLabs();
    const requests = getRequests();
    return {
      allItems: items,
      departments: depts,
      labs: allLabs,
      deptMap: new Map(depts.map((d) => [d.id, d])),
      itemMap: new Map(items.map((item) => [item.id, item])),
      allRequests: requests,
    };
  }, [dataVersion]);

  const initialItem =
    allItems.find((item) => item.id === selectedItemId) ??
    allItems.find((item) => item.accessLevel !== 'Open') ??
    allItems[0];

  const [project, setProject] = useState('');
  const [subjectCourse, setSubjectCourse] = useState('');
  const [departmentId, setDepartmentId] = useState(
    initialItem?.departmentId ?? departments[0]?.id ?? ''
  );
  const [teamSize, setTeamSize] = useState<number>(2);
  const [deadline, setDeadline] = useState('2026-12-10');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(
    initialItem ? [initialItem.id] : []
  );
  const [equipmentQuery, setEquipmentQuery] = useState('');
  const [hoursNeeded, setHoursNeeded] = useState<number>(6);
  const [justification, setJustification] = useState('');
  const [trainingConfirmed, setTrainingConfirmed] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<RequestFieldKey, string>>
  >({});
  const [liveMessage, setLiveMessage] = useState('');

  const projectRef = useRef<HTMLInputElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const departmentRef = useRef<HTMLSelectElement | null>(null);
  const teamSizeRef = useRef<HTMLInputElement | null>(null);
  const deadlineRef = useRef<HTMLInputElement | null>(null);
  const equipmentSearchRef = useRef<HTMLInputElement | null>(null);
  const hoursRef = useRef<HTMLInputElement | null>(null);
  const justificationRef = useRef<HTMLTextAreaElement | null>(null);
  const trainingRef = useRef<HTMLInputElement | null>(null);

  const validSelectedIds = selectedItemIds.filter((id) => itemMap.has(id));
  const selectedItems = validSelectedIds
    .map((id) => itemMap.get(id))
    .filter((item): item is EquipmentItem => Boolean(item));
  const requiresTraining = selectedItems.some(
    (item) => item.accessLevel === 'Training required'
  );

  const normalizedEquipQuery = equipmentQuery.trim().toLowerCase();
  const groupedCatalog = useMemo(
    () =>
      departments
        .map((dept) => {
          const deptLabs = labs
            .filter((lab) => lab.departmentId === dept.id)
            .map((lab) => {
              const matchingItems = allItems.filter((item) => {
                if (item.labId !== lab.id) return false;
                if (!normalizedEquipQuery) return true;
                const haystack =
                  `${item.name} ${item.type} ${item.accessLevel} ${dept.name} ${lab.name}`.toLowerCase();
                return haystack.includes(normalizedEquipQuery);
              });
              return { lab, items: matchingItems };
            })
            .filter((group) => group.items.length > 0);
          return { dept, labs: deptLabs };
        })
        .filter((group) => group.labs.length > 0),
    [departments, labs, allItems, normalizedEquipQuery]
  );

  const myRequests = useMemo(
    () =>
      allRequests.filter(
        (req) => req.studentId === currentUser.id || req.student === currentUser.name
      ),
    [allRequests, currentUser.id, currentUser.name]
  );

  const focusField = (field: RequestFieldKey) => {
    const refMap: Record<
      RequestFieldKey,
      { current: HTMLElement | null }
    > = {
      project: projectRef,
      subjectCourse: subjectRef,
      departmentId: departmentRef,
      teamSize: teamSizeRef,
      deadline: deadlineRef,
      itemIds: equipmentSearchRef,
      hoursNeeded: hoursRef,
      justification: justificationRef,
      trainingConfirmed: trainingRef,
    };
    refMap[field].current?.focus();
  };

  const toggleEquipmentItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setFieldErrors((prev) => {
      if (!prev.itemIds && !prev.trainingConfirmed) return prev;
      const next = { ...prev };
      delete next.itemIds;
      delete next.trainingConfirmed;
      return next;
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLiveMessage('');

    const validation = validateRequest(
      {
        project,
        subjectCourse,
        departmentId,
        teamSize,
        deadline,
        itemIds: validSelectedIds,
        hoursNeeded,
        justification,
        trainingConfirmed,
      },
      {
        departments,
        items: allItems,
        referenceDate: DEFAULT_REFERENCE_DATE,
      }
    );

    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      const firstError = validation.errors[0];
      if (firstError) {
        focusField(firstError.field);
      }
      return;
    }

    const created = submitAccessRequest({
      project,
      subjectCourse,
      departmentId,
      teamSize,
      deadline,
      itemIds: validSelectedIds,
      hoursNeeded,
      justification,
      trainingConfirmed,
    });

    if (created) {
      setFieldErrors({});
      setProject('');
      setSubjectCourse('');
      setEquipmentQuery('');
      setSelectedItemIds([]);
      setTeamSize(2);
      setHoursNeeded(6);
      setJustification('');
      setTrainingConfirmed(false);
      setLiveMessage(
        `Access request ${created.id} submitted for ${created.equipmentNeeded}. Status: Submitted.`
      );
      onDataMutated();
    }
  };

  const handleResubmit = (requestId: string, projectTitle: string) => {
    const result = transitionAccessRequest(requestId, 'Submitted');
    if (result?.ok) {
      setLiveMessage(
        `Resubmitted "${projectTitle}" to faculty review queue (Status: Submitted).`
      );
      onDataMutated();
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Notebook-style Request Form */}
        <section className="notebook-sheet p-6 xl:col-span-6">
          <h1 className="text-3xl font-bold text-[var(--ink)]">
            Request Lab Access
          </h1>
          <p className="mt-1 text-base text-[var(--ink)]">
            Apply for faculty clearance or safety-certified bench access. Approved items unlock immediately in Smart Booking.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="req-student"
                className="block text-base font-bold text-[var(--ink)]"
              >
                Applicant
              </label>
              <input
                id="req-student"
                type="text"
                readOnly
                value={`${currentUser.name} (${currentUser.id})`}
                className="notebook-input mt-1 bg-[var(--paper)]"
              />
            </div>

            <div>
              <label
                htmlFor="req-project"
                className="block text-base font-bold text-[var(--ink)]"
              >
                Project title (required)
              </label>
              <input
                ref={projectRef}
                id="req-project"
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.project)}
                aria-describedby={fieldErrors.project ? 'err-project' : undefined}
                placeholder="e.g., Autonomous Optical Flow Bench Test"
                className="notebook-input mt-1"
              />
              {fieldErrors.project && (
                <p
                  id="err-project"
                  role="alert"
                  className="mt-1 text-sm font-bold text-[var(--ink)] underline decoration-[var(--ink)]"
                >
                  {fieldErrors.project}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="req-subject"
                  className="block text-base font-bold text-[var(--ink)]"
                >
                  Subject / course (required)
                </label>
                <input
                  ref={subjectRef}
                  id="req-subject"
                  type="text"
                  value={subjectCourse}
                  onChange={(e) => setSubjectCourse(e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.subjectCourse)}
                  aria-describedby={
                    fieldErrors.subjectCourse ? 'err-subject' : undefined
                  }
                  placeholder="e.g., ECE 441 · Embedded Systems"
                  className="notebook-input mt-1"
                />
                {fieldErrors.subjectCourse && (
                  <p id="err-subject" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                    {fieldErrors.subjectCourse}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="req-department"
                  className="block text-base font-bold text-[var(--ink)]"
                >
                  Department (required)
                </label>
                <select
                  ref={departmentRef}
                  id="req-department"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.departmentId)}
                  aria-describedby={
                    fieldErrors.departmentId ? 'err-department' : undefined
                  }
                  className="notebook-input mt-1"
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.departmentId && (
                  <p id="err-department" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                    {fieldErrors.departmentId}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="req-team"
                  className="block text-base font-bold text-[var(--ink)]"
                >
                  Team members (required)
                </label>
                <input
                  ref={teamSizeRef}
                  id="req-team"
                  type="number"
                  min={1}
                  max={10}
                  value={teamSize}
                  onChange={(e) => setTeamSize(Number(e.target.value))}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.teamSize)}
                  aria-describedby={fieldErrors.teamSize ? 'err-team' : undefined}
                  className="notebook-input mt-1 tabular-nums"
                />
                {fieldErrors.teamSize && (
                  <p id="err-team" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                    {fieldErrors.teamSize}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="req-deadline"
                  className="block text-base font-bold text-[var(--ink)]"
                >
                  Deadline (required)
                </label>
                <input
                  ref={deadlineRef}
                  id="req-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.deadline)}
                  aria-describedby={
                    fieldErrors.deadline ? 'err-deadline' : undefined
                  }
                  className="notebook-input mt-1 tabular-nums"
                />
                {fieldErrors.deadline && (
                  <p id="err-deadline" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                    {fieldErrors.deadline}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="req-hours"
                  className="block text-base font-bold text-[var(--ink)]"
                >
                  Hours needed (required)
                </label>
                <input
                  ref={hoursRef}
                  id="req-hours"
                  type="number"
                  min={1}
                  max={100}
                  value={hoursNeeded}
                  onChange={(e) => setHoursNeeded(Number(e.target.value))}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.hoursNeeded)}
                  aria-describedby={
                    fieldErrors.hoursNeeded ? 'err-hours' : undefined
                  }
                  className="notebook-input mt-1 tabular-nums"
                />
                {fieldErrors.hoursNeeded && (
                  <p id="err-hours" role="alert" className="mt-1 text-sm font-bold text-[var(--ink)]">
                    {fieldErrors.hoursNeeded}
                  </p>
                )}
              </div>
            </div>

            {/* Searchable Multi-Select Equipment Picker Grouped by Department > Lab */}
            <fieldset className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-3.5">
              <legend className="px-1.5 text-base font-bold text-[var(--ink)]">
                Equipment needed (required · {selectedItems.length} selected)
              </legend>

              <label
                htmlFor="req-equip-search"
                className="block text-sm font-bold text-[var(--ink)]"
              >
                Search equipment catalog (by name, lab, or department)
              </label>
              <div className="relative mt-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink)]"
                  aria-hidden="true"
                />
                <input
                  ref={equipmentSearchRef}
                  id="req-equip-search"
                  type="search"
                  value={equipmentQuery}
                  onChange={(e) => setEquipmentQuery(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.itemIds)}
                  aria-describedby={
                    fieldErrors.itemIds ? 'err-equipment' : undefined
                  }
                  placeholder="Type instrument, kit, or lab name..."
                  className="notebook-input !pl-9"
                />
              </div>

              {selectedItems.length > 0 && (
                <div
                  className="mt-2.5 flex flex-wrap gap-2"
                  aria-label="Selected equipment items"
                >
                  {selectedItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleEquipmentItem(item.id)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-[8px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-3 py-1.5 text-sm font-bold text-[var(--on-lavender)]"
                      aria-label={`Remove ${item.name}`}
                    >
                      <span>{item.name}</span>
                      <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}

              <div
                className="mt-3 max-h-60 space-y-3 overflow-y-auto rounded-[10px] border-2 border-[var(--ink)] bg-[var(--white)] p-3"
                onChange={(event: ChangeEvent<HTMLDivElement>) => {
                  const input = (event.target as HTMLElement).closest<HTMLInputElement>(
                    'input[type="checkbox"][data-equip-id]'
                  );
                  const equipId = input?.dataset.equipId;
                  if (equipId) {
                    toggleEquipmentItem(equipId);
                  }
                }}
              >
                {groupedCatalog.length === 0 ? (
                  <p className="text-sm text-[var(--ink)]">
                    No catalog items match &ldquo;{equipmentQuery}&rdquo;.
                  </p>
                ) : (
                  groupedCatalog.map(({ dept, labs: deptLabs }) => (
                    <div key={dept.id} className="space-y-2">
                      {deptLabs.map(({ lab, items: labItems }) => (
                        <div key={lab.id}>
                          <div className="border-b border-dashed border-[var(--border-subtle)] pb-0.5 text-sm font-bold text-[var(--ink)]">
                            {dept.name} &gt; {lab.name} ({lab.room})
                          </div>
                          <ul className="mt-1 space-y-1">
                            {labItems.map((item) => {
                              const checked = selectedItemIds.includes(item.id);
                              return (
                                <li key={item.id}>
                                  <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--lavender-soft)]">
                                    <input
                                      type="checkbox"
                                      data-equip-id={item.id}
                                      checked={checked}
                                      onChange={() => undefined}
                                      className="h-5 w-5 shrink-0 accent-[var(--ink)]"
                                    />
                                    <span className="flex-1">
                                      <span className="font-bold">{item.name}</span>
                                      <span className="block text-xs">
                                        {item.type} · {item.accessLevel}
                                      </span>
                                    </span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>

              {fieldErrors.itemIds && (
                <p id="err-equipment" role="alert" className="mt-1.5 text-sm font-bold text-[var(--ink)]">
                  {fieldErrors.itemIds}
                </p>
              )}
            </fieldset>

            <div>
              <label
                htmlFor="req-justification"
                className="block text-base font-bold text-[var(--ink)]"
              >
                Justification &amp; experiment plan (required, 10–500 characters)
              </label>
              <textarea
                ref={justificationRef}
                id="req-justification"
                rows={3}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.justification)}
                aria-describedby={
                  fieldErrors.justification ? 'err-justification' : undefined
                }
                placeholder="Describe materials, measurement goals, and faculty sponsor..."
                className="notebook-input mt-1"
              />
              {fieldErrors.justification && (
                <p
                  id="err-justification"
                  role="alert"
                  className="mt-1 text-sm font-bold text-[var(--ink)]"
                >
                  {fieldErrors.justification}
                </p>
              )}
            </div>

            <div className="rounded-[10px] border-2 border-[var(--ink)] bg-[var(--paper)] p-3">
              <label
                htmlFor="req-training"
                className="flex min-h-[44px] cursor-pointer items-start gap-2.5 text-base text-[var(--ink)]"
              >
                <input
                  ref={trainingRef}
                  id="req-training"
                  type="checkbox"
                  checked={trainingConfirmed}
                  onChange={(e) => setTrainingConfirmed(e.target.checked)}
                  aria-required={requiresTraining}
                  aria-invalid={Boolean(fieldErrors.trainingConfirmed)}
                  aria-describedby={
                    fieldErrors.trainingConfirmed ? 'err-training' : undefined
                  }
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--ink)]"
                />
                <span>
                  <span className="font-bold">
                    Safety &amp; instrument training completed
                  </span>
                  {requiresTraining ? (
                    <span className="block text-sm font-bold">
                      Required: your selection includes training-gated equipment.
                    </span>
                  ) : (
                    <span className="block text-sm">
                      Check if you already hold bench safety certification for these tools.
                    </span>
                  )}
                </span>
              </label>
              {fieldErrors.trainingConfirmed && (
                <p id="err-training" role="alert" className="mt-1.5 text-sm font-bold text-[var(--ink)]">
                  {fieldErrors.trainingConfirmed}
                </p>
              )}
            </div>

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

        {/* Student's "Your requests" Panel */}
        <section className="notebook-sheet notebook-sheet-alt-tape p-6 xl:col-span-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-[var(--ink)] pb-3">
            <div>
              <h2 className="text-2xl font-bold text-[var(--ink)]">
                Your requests
              </h2>
              <p className="text-sm text-[var(--ink)]">
                Tracking submissions for {currentUser.name} ({currentUser.id})
              </p>
            </div>
            <span className="tabular-nums text-base font-bold text-[var(--ink)]">
              {myRequests.length} request{myRequests.length === 1 ? '' : 's'}
            </span>
          </div>

          {myRequests.length === 0 ? (
            <div className="py-10 text-center">
              <HeroBenchDoodle className="mx-auto mb-4 h-36 w-auto" />
              <h3 className="text-2xl font-bold text-[var(--ink)]">
                No access requests yet
              </h3>
              <p className="mx-auto mt-1 max-w-md text-base text-[var(--ink)]">
                Submit a request using the notebook form to track faculty clearance and unlock restricted instruments.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {myRequests.map((req) => {
                const statusMeta = REQUEST_STATUS_META[req.status];
                const StatusIcon = statusMeta.Icon;
                const activeStage = getStageIndex(req.status);
                const dept = deptMap.get(req.departmentId);

                return (
                  <li
                    key={req.id}
                    className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="tabular-nums text-xs font-bold text-[var(--ink)]">
                          {req.id} · {req.subjectCourse ?? 'Course project'}
                        </span>
                        <h3 className="text-xl font-bold text-[var(--ink)]">
                          {req.project}
                        </h3>
                      </div>

                      <span className={statusMeta.className}>
                        <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{req.status}</span>
                      </span>
                    </div>

                    <p className="mt-1 text-base font-bold text-[var(--ink)]">
                      {req.equipmentNeeded}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--ink)]">
                      <span>{dept?.name ?? req.departmentId}</span>
                      <span className="tabular-nums">Team: {req.teamSize}</span>
                      <span className="tabular-nums">Hours: {req.hoursNeeded}h</span>
                      <span className="tabular-nums">Deadline: {req.deadline}</span>
                    </div>

                    {/* Status Stepper */}
                    <ol
                      aria-label={`Request status progress for ${req.project}`}
                      className="mt-3 grid grid-cols-3 gap-2"
                    >
                      {STEPPER_STAGES.map((stage, idx) => {
                        const isFinalBranch =
                          idx === 2 &&
                          (req.status === 'Rejected' ||
                            req.status === 'Changes requested');
                        const displayLabel =
                          idx === 2 && req.status === 'Rejected'
                            ? 'Rejected'
                            : idx === 2 && req.status === 'Changes requested'
                              ? 'Changes needed'
                              : stage;
                        const reached = idx <= activeStage;

                        return (
                          <li
                            key={stage}
                            className={`rounded-[8px] border-2 border-[var(--ink)] px-2.5 py-1.5 text-center text-xs font-bold ${
                              isFinalBranch
                                ? 'bg-[var(--status-booked-bg)] text-[var(--ink)]'
                                : reached
                                  ? 'bg-[var(--lavender)] text-[var(--on-lavender)]'
                                  : 'bg-[var(--white)] text-[var(--ink)]'
                            }`}
                          >
                            {idx + 1}. {displayLabel}
                          </li>
                        );
                      })}
                    </ol>

                    {(req.status === 'Rejected' ||
                      req.status === 'Changes requested' ||
                      req.facultyNote) && (
                      <div className="mt-3 rounded-[8px] border-2 border-[var(--ink)] bg-[var(--white)] px-3 py-2 text-sm text-[var(--ink)]">
                        <strong>Faculty note:</strong>{' '}
                        {req.facultyNote || 'Pending supervisor comment.'}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {req.status === 'Changes requested' && (
                        <button
                          type="button"
                          onClick={() => handleResubmit(req.id, req.project)}
                          className="labora-btn text-sm"
                        >
                          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
                          Resubmit request
                        </button>
                      )}

                      {req.status === 'Approved' && (
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate('booking', { itemId: req.itemId })
                          }
                          className="labora-btn text-sm"
                        >
                          <span>Book in Smart Booking</span>
                          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
