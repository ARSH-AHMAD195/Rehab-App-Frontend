import { useQuery } from '@tanstack/react-query';
import { vitalsService } from '../services/apiServices';
import { qk } from './queryClient';
import { labelize } from './format';
import { isHindi, t } from './i18n';

/** A vital's name. In Hindi: the API's labelHi once filled in, else ours by its code; otherwise the API's own label. */
export const vitalName = (type: string, label: string, labelHi?: string | null) => {
  if (isHindi() && labelHi) return labelHi;
  const key = `vital:${type}`;
  const name = t(key);
  return name === key ? label : name;
};

/** The 13 readings the clinic asks for. They change only when an admin edits them, so fetch once per session. */
export const useVitalTypes = () => useQuery({ queryKey: qk.vitalTypes, queryFn: vitalsService.getTypes, staleTime: Infinity });

/** "SPO2" -> "SpO2", "WALK_MIN" -> "Walking duration": the API's own labels, falling back to the code. */
export const useVitalLabel = () => {
  const types = useVitalTypes();
  return (type: string) => {
    const def = types.data?.find((d) => d.type === type);
    return vitalName(type, def?.label ?? labelize(type), def?.labelHi);
  };
};
