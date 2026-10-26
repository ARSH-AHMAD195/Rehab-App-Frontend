import { useQuery } from '@tanstack/react-query';
import { vitalsService } from '../services/apiServices';
import { qk } from './queryClient';
import { labelize } from './format';

/** The 13 readings the clinic asks for. They change only when an admin edits them, so fetch once per session. */
export const useVitalTypes = () => useQuery({ queryKey: qk.vitalTypes, queryFn: vitalsService.getTypes, staleTime: Infinity });

/** "SPO2" -> "SpO2", "WALK_MIN" -> "Walking duration": the API's own labels, falling back to the code. */
export const useVitalLabel = () => {
  const types = useVitalTypes();
  return (type: string) => types.data?.find((t) => t.type === type)?.label ?? labelize(type);
};
