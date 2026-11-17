import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCheck, UserMinus } from 'lucide-react';
import { patientService } from '../../services/apiServices';
import { ApiError, errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { useSignedInUser } from '../../context/AuthContext';
import { Button } from '../ui';
import { useToast } from '../ui/toast';
import type { Patient } from '../../types/api';

/** Links or unlinks the signed-in doctor: linked doctors get the patient's alerts. */
export const MyPatientToggle = ({ patient }: { patient: Patient }) => {
  const me = useSignedInUser();
  const toast = useToast();
  const queryClient = useQueryClient();
  const mine = patient.doctors.some((d) => d.id === me.id);

  const toggle = useMutation({
    mutationFn: () => (mine ? patientService.unlinkMe(patient.id) : patientService.linkMe(patient.id)),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.patient(patient.id), updated);
      void queryClient.invalidateQueries({ queryKey: qk.patient(patient.id) });
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success(mine ? `${patient.name} removed from your patients.` : `${patient.name} added to your patients.`);
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError && err.code === 'LAST_DOCTOR'
          ? 'You’re this patient’s only doctor. Another doctor must add them first.'
          : errorMessage(err, 'Could not update your patients.'),
      ),
  });

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="secondary" size="sm" onClick={() => toggle.mutate()} loading={toggle.isPending}>
        {mine ? <UserMinus className="h-4 w-4" aria-hidden="true" /> : <UserCheck className="h-4 w-4" aria-hidden="true" />}
        {mine ? 'Remove from my patients' : 'Add to my patients'}
      </Button>
      <span className="text-xs text-slate-600">{mine ? 'You get this patient’s alerts' : 'You’ll get this patient’s alerts'}</span>
    </div>
  );
};
