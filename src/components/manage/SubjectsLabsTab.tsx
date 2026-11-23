/**
 * Subjects and Laboratories CRUD management tab panel.
 */
import { FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Department, EquipmentItem, Lab } from '../../js/types';

interface SubjectsLabsTabProps {
  departments: Department[];
  labs: Lab[];
  items: EquipmentItem[];
  onOpenDeptModal: (
    mode: 'add' | 'edit',
    trigger: HTMLButtonElement,
    dept?: Department
  ) => void;
  onOpenLabModal: (
    mode: 'add' | 'edit',
    trigger: HTMLButtonElement,
    options?: { defaultDeptId?: string; lab?: Lab }
  ) => void;
  onOpenDeleteModal: (
    entityType: 'department' | 'lab',
    entityId: string,
    entityName: string,
    trigger: HTMLButtonElement
  ) => void;
}

function LabRowItem({
  lab,
  itemCount,
  onEdit,
  onDelete,
}: {
  lab: Lab;
  itemCount: number;
  onEdit: (trigger: HTMLButtonElement) => void;
  onDelete: (trigger: HTMLButtonElement) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--white)] px-3 py-2.5">
      <div>
        <div className="font-bold text-[var(--ink)]">
          {lab.name}{' '}
          <span className="tabular-nums text-sm font-normal">({lab.room})</span>
        </div>
        <div className="text-xs text-[var(--ink)]">
          {lab.supervisor} · {lab.hours} ·{' '}
          <span className="tabular-nums font-bold">
            {itemCount} equipment item{itemCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(e) => onEdit(e.currentTarget)}
          aria-label={`Edit lab ${lab.name}`}
          className="labora-btn labora-btn-paper text-xs"
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={(e) => onDelete(e.currentTarget)}
          aria-label={`Delete lab ${lab.name}`}
          className="labora-btn !bg-[var(--status-booked-bg)] text-xs"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Delete
        </button>
      </div>
    </li>
  );
}

function DepartmentCard({
  dept,
  deptLabs,
  items,
  onOpenDeptModal,
  onOpenLabModal,
  onOpenDeleteModal,
}: {
  dept: Department;
  deptLabs: Lab[];
  items: EquipmentItem[];
  onOpenDeptModal: SubjectsLabsTabProps['onOpenDeptModal'];
  onOpenLabModal: SubjectsLabsTabProps['onOpenLabModal'];
  onOpenDeleteModal: SubjectsLabsTabProps['onOpenDeleteModal'];
}) {
  const deptItemCount = items.filter((i) => i.departmentId === dept.id).length;

  return (
    <li className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[6px] border-2 border-[var(--ink)] bg-[var(--lavender)] px-2 py-0.5 text-xs font-bold text-[var(--on-lavender)]">
              {dept.code}
            </span>
            <h3 className="text-xl font-bold text-[var(--ink)]">{dept.name}</h3>
          </div>
          <p className="mt-1 text-sm text-[var(--ink)]">
            {dept.building} · Lead: {dept.leadFaculty} ·{' '}
            <span className="tabular-nums font-bold">
              {deptLabs.length} lab{deptLabs.length === 1 ? '' : 's'}, {deptItemCount} item
              {deptItemCount === 1 ? '' : 's'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(e) => onOpenLabModal('add', e.currentTarget, { defaultDeptId: dept.id })}
            className="labora-btn labora-btn-paper text-xs"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Add lab
          </button>
          <button
            type="button"
            onClick={(e) => onOpenDeptModal('edit', e.currentTarget, dept)}
            aria-label={`Edit subject ${dept.name}`}
            className="labora-btn labora-btn-paper text-xs"
          >
            <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            onClick={(e) => onOpenDeleteModal('department', dept.id, dept.name, e.currentTarget)}
            aria-label={`Delete subject ${dept.name}`}
            className="labora-btn !bg-[var(--status-booked-bg)] text-xs"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Delete
          </button>
        </div>
      </div>

      {deptLabs.length === 0 ? (
        <p className="mt-3 rounded-[8px] border border-dashed border-[var(--border-subtle)] bg-[var(--white)] px-3 py-2 text-sm text-[var(--ink)]">
          No laboratories in {dept.name} yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 border-t-2 border-dashed border-[var(--border-subtle)] pt-3 pl-3">
          {deptLabs.map((lab) => (
            <LabRowItem
              key={lab.id}
              lab={lab}
              itemCount={items.filter((i) => i.labId === lab.id).length}
              onEdit={(btn) => onOpenLabModal('edit', btn, { lab })}
              onDelete={(btn) => onOpenDeleteModal('lab', lab.id, lab.name, btn)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Renders the faculty Subjects & Laboratories hierarchy with add, edit, and delete controls.
 *
 * @param props - Catalog collections and modal opener handlers.
 * @returns Section containing departments and their child laboratories.
 */
export function SubjectsLabsTab({
  departments,
  labs,
  items,
  onOpenDeptModal,
  onOpenLabModal,
  onOpenDeleteModal,
}: SubjectsLabsTabProps) {
  return (
    <section className="notebook-sheet p-6" aria-labelledby="manage-subjects-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-4">
        <div>
          <h2 id="manage-subjects-heading" className="text-2xl font-bold text-[var(--ink)]">
            Subjects &amp; Laboratories
          </h2>
          <p className="text-sm text-[var(--ink)]">
            {departments.length} subjects · {labs.length} laboratories in campus notebook
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(e) => onOpenDeptModal('add', e.currentTarget)}
            className="labora-btn text-sm"
          >
            <FolderPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
            Add subject
          </button>
          <button
            type="button"
            disabled={departments.length === 0}
            onClick={(e) => onOpenLabModal('add', e.currentTarget)}
            className="labora-btn labora-btn-paper text-sm"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            Add lab
          </button>
        </div>
      </div>

      {departments.length === 0 ? (
        <p className="mt-5 text-base text-[var(--ink)]">
          No subjects configured yet. Add a subject to start creating campus laboratories.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              dept={dept}
              deptLabs={labs.filter((l) => l.departmentId === dept.id)}
              items={items}
              onOpenDeptModal={onOpenDeptModal}
              onOpenLabModal={onOpenLabModal}
              onOpenDeleteModal={onOpenDeleteModal}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
