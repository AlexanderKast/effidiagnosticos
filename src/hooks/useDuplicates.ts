import { useMemo } from 'react';
import { AppointmentCRM, DuplicatesMap, buildDuplicatesMap } from '@/lib/crmUtils';

export function useDuplicates(appointments: AppointmentCRM[]): {
  duplicatesMap: DuplicatesMap;
  duplicateCount: number;
  getDuplicatesFor: (appt: AppointmentCRM) => AppointmentCRM[];
} {
  const duplicatesMap = useMemo(() => buildDuplicatesMap(appointments), [appointments]);

  const duplicateCount = useMemo(
    () => Object.keys(duplicatesMap).length,
    [duplicatesMap],
  );

  const getDuplicatesFor = (appt: AppointmentCRM): AppointmentCRM[] => {
    const email = appt.lead_email?.trim().toLowerCase();
    if (!email) return [];
    return (duplicatesMap[email] ?? []).filter((a) => a.id !== appt.id);
  };

  return { duplicatesMap, duplicateCount, getDuplicatesFor };
}
