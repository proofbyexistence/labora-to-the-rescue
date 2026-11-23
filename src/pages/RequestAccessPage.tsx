/**
 * Request Access page: multi-item clearance submission form, validation, and request status tracker.
 */
import { useMemo, useState } from 'react';
import { AccessRequestForm } from '../components/AccessRequestForm';
import type { PageId } from '../components/EquipmentCard';
import { MyRequestsList } from '../components/MyRequestsList';
import {
  getDepartments,
  getItems,
  getLabs,
  getRequests,
  getStateVersion,
  transitionAccessRequest,
} from '../js/lab-data';
import type { CampusUser } from '../js/types';

interface RequestAccessPageProps {
  selectedItemId: string;
  currentUser: CampusUser;
  onNavigate: (
    page: PageId,
    options?: { departmentId?: string; labId?: string; itemId?: string }
  ) => void;
  onDataMutated: () => void;
}

/**
 * Coordinates the lab access request form and the student's live request tracker panel.
 *
 * @param props - Selected item ID, active user, navigation handler, and mutation callback.
 * @returns Two-column Request Access page layout.
 */
export function RequestAccessPage({
  selectedItemId,
  currentUser,
  onNavigate,
  onDataMutated,
}: RequestAccessPageProps) {
  const dataVersion = getStateVersion();
  const [liveMessage, setLiveMessage] = useState('');

  const { allItems, departments, labs, deptMap, allRequests } = useMemo(() => {
    const items = getItems();
    const depts = getDepartments();
    return {
      allItems: items,
      departments: depts,
      labs: getLabs(),
      deptMap: new Map(depts.map((d) => [d.id, d])),
      allRequests: getRequests(),
    };
  }, [dataVersion]);

  const initialItem =
    allItems.find((item) => item.id === selectedItemId) ??
    allItems.find((item) => item.accessLevel !== 'Open') ??
    allItems[0];

  const myRequests = useMemo(
    () =>
      allRequests.filter(
        (req) => req.studentId === currentUser.id || req.student === currentUser.name
      ),
    [allRequests, currentUser.id, currentUser.name]
  );

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
        <AccessRequestForm
          currentUser={currentUser}
          departments={departments}
          labs={labs}
          allItems={allItems}
          initialItem={initialItem}
          liveMessage={liveMessage}
          onLiveMessage={setLiveMessage}
          onDataMutated={onDataMutated}
        />

        <MyRequestsList
          currentUser={currentUser}
          requests={myRequests}
          deptMap={deptMap}
          onResubmit={handleResubmit}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
