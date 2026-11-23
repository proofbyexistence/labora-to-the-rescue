/**
 * Faculty Approvals & Manage page: approval queue, conflict/utilization analytics, and catalog tabs.
 */
import { lazy, Suspense } from 'react';
import { Home, ShieldAlert } from 'lucide-react';
import { DecisionReasonModal } from '../components/DecisionReasonModal';
import type { PageId } from '../components/EquipmentCard';
import { FacultyAnalyticsSidebar } from '../components/FacultyAnalyticsSidebar';
import { FacultyApprovalCard } from '../components/FacultyApprovalCard';
import { FacultySummaryStrip } from '../components/FacultySummaryStrip';
import { HeroBenchDoodle } from '../components/LabDoodles';
import { useFacultyApprovals } from '../js/use-faculty-approvals';
import type { CampusUser } from '../js/types';

const CatalogManagePanel = lazy(() =>
  import('../components/CatalogManagePanel').then((m) => ({
    default: m.CatalogManagePanel,
  }))
);

interface FacultyApprovalsPageProps {
  currentUser: CampusUser;
  onNavigate: (
    page: PageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => void;
  onDataMutated: () => void;
}

function FacultyRoleGuard({
  onNavigate,
}: {
  onNavigate: FacultyApprovalsPageProps['onNavigate'];
}) {
  return (
    <section className="notebook-sheet p-8 text-center">
      <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-[var(--ink)]" aria-hidden="true" />
      <h1 className="text-3xl font-bold text-[var(--ink)]">Faculty access only</h1>
      <p className="mx-auto mt-2 max-w-lg text-base text-[var(--ink)]">
        The Faculty Approvals queue, utilization analytics, and sign-off controls are restricted to faculty reviewers. Use the demo role switch in the top bar if you want to preview the faculty workspace.
      </p>
      <div className="mt-5 flex justify-center">
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('home');
          }}
          className="labora-btn"
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Back to Home</span>
        </a>
      </div>
    </section>
  );
}

/**
 * Coordinates faculty approvals, conflict/utilization analytics, and catalog management tabs.
 *
 * @param props - Active campus user, page navigation handler, and state refresh callback.
 * @returns Faculty Approvals & Manage workspace or student role guard.
 */
export function FacultyApprovalsPage({
  currentUser,
  onNavigate,
  onDataMutated,
}: FacultyApprovalsPageProps) {
  const vm = useFacultyApprovals(currentUser, onDataMutated);
  if (!vm.isFaculty) return <FacultyRoleGuard onNavigate={onNavigate} />;

  return (
    <div className="space-y-6">
      <FacultySummaryStrip
        currentUser={currentUser}
        activeTab={vm.activeTab}
        queueFilter={vm.queueFilter}
        departmentFilter={vm.departmentFilter}
        departments={vm.workspace.departments}
        labCount={vm.workspace.labs.length}
        summary={vm.workspace.summary}
        liveNotice={vm.liveNotice}
        onTabChange={vm.setActiveTab}
        onQueueFilterChange={vm.setQueueFilter}
        onDepartmentFilterChange={vm.setDepartmentFilter}
      />

      {vm.activeTab === 'approvals' ? (
        <div
          id="faculty-panel-approvals"
          role="tabpanel"
          aria-labelledby="faculty-tab-approvals"
          className="grid grid-cols-1 gap-6 xl:grid-cols-12"
        >
          <section aria-label="Approval queue" className="space-y-4 xl:col-span-7">
            {vm.filteredRequests.length === 0 ? (
              <div className="notebook-sheet p-8 text-center">
                <HeroBenchDoodle className="mx-auto mb-3 h-32 w-auto" />
                <h2 className="text-2xl font-bold text-[var(--ink)]">No matching requests</h2>
                <p className="mt-1 text-base text-[var(--ink)]">
                  Try switching back to All Requests or clearing the department filter.
                </p>
              </div>
            ) : (
              vm.filteredRequests.map((req, index) => (
                <FacultyApprovalCard
                  key={req.id}
                  request={req}
                  index={index}
                  departmentName={vm.workspace.deptMap.get(req.departmentId)}
                  primaryItem={vm.workspace.itemMap.get(req.itemId)}
                  allSlots={vm.workspace.allSlots}
                  onStartReview={vm.handleStartReview}
                  onApprove={vm.handleApprove}
                  onOpenReasonModal={vm.openReasonModal}
                />
              ))
            )}
          </section>

          <FacultyAnalyticsSidebar
            openConflicts={vm.workspace.openConflicts}
            itemMap={vm.workspace.itemMap}
            labCount={vm.workspace.labs.length}
            overallUtilizationPct={vm.workspace.summary.overallUtilizationPct}
            labUtilizations={vm.workspace.labUtilizations}
            underusedItems={vm.workspace.underusedItems}
            onNavigate={onNavigate}
          />
        </div>
      ) : (
        <div
          id={`faculty-panel-${vm.activeTab}`}
          role="tabpanel"
          aria-labelledby={`faculty-tab-${vm.activeTab}`}
        >
          <Suspense
            fallback={
              <section
                aria-label="Loading catalog management tools"
                className="notebook-sheet chart-panel-stable flex items-center justify-center p-8 text-base text-[var(--ink)]"
              >
                Loading management workspace...
              </section>
            }
          >
            <CatalogManagePanel
              activeTab={vm.activeTab}
              onNotify={(kind, text) => vm.setLiveNotice({ kind, text })}
              onDataMutated={onDataMutated}
            />
          </Suspense>
        </div>
      )}

      <DecisionReasonModal
        modalState={vm.modalState}
        reasonDraft={vm.reasonDraft}
        reasonError={vm.reasonError}
        reasonInputRef={vm.reasonInputRef}
        onReasonChange={(val) => {
          vm.setReasonDraft(val);
          if (vm.reasonError) vm.setReasonError('');
        }}
        onClose={vm.closeReasonModal}
        onConfirm={vm.handleConfirmReason}
      />
    </div>
  );
}
