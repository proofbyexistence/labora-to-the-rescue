/**
 * Applicant, project title, subject/course, and department header fields for AccessRequestForm.
 */
import type { RequestFieldKey } from '../js/requests';
import type { CampusUser, Department } from '../js/types';
import type { RequestFormRefs } from './RequestScheduleSection';

/**
 * Renders applicant identity, project title, subject/course, and department fields.
 *
 * @param props - Current user, field values, departments, validation errors, refs, and setters.
 * @returns Header inputs group inside the access request form.
 */
export function RequestHeaderFields({
  currentUser,
  project,
  subjectCourse,
  departmentId,
  departments,
  fieldErrors,
  refs,
  onProjectChange,
  onSubjectChange,
  onDepartmentChange,
}: {
  currentUser: CampusUser;
  project: string;
  subjectCourse: string;
  departmentId: string;
  departments: Department[];
  fieldErrors: Partial<Record<RequestFieldKey, string>>;
  refs: Pick<RequestFormRefs, 'project' | 'subjectCourse' | 'departmentId'>;
  onProjectChange: (v: string) => void;
  onSubjectChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
}) {
  return (
    <>
      <div>
        <label htmlFor="req-student" className="block text-base font-bold text-[var(--ink)]">
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
        <label htmlFor="req-project" className="block text-base font-bold text-[var(--ink)]">
          Project title (required)
        </label>
        <input
          ref={refs.project}
          id="req-project"
          type="text"
          value={project}
          onChange={(e) => onProjectChange(e.target.value)}
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
          <label htmlFor="req-subject" className="block text-base font-bold text-[var(--ink)]">
            Subject / course (required)
          </label>
          <input
            ref={refs.subjectCourse}
            id="req-subject"
            type="text"
            value={subjectCourse}
            onChange={(e) => onSubjectChange(e.target.value)}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.subjectCourse)}
            aria-describedby={fieldErrors.subjectCourse ? 'err-subject' : undefined}
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
          <label htmlFor="req-department" className="block text-base font-bold text-[var(--ink)]">
            Department (required)
          </label>
          <select
            ref={refs.departmentId}
            id="req-department"
            value={departmentId}
            onChange={(e) => onDepartmentChange(e.target.value)}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.departmentId)}
            aria-describedby={fieldErrors.departmentId ? 'err-department' : undefined}
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
    </>
  );
}
