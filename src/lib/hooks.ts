import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { nutritionService } from '../services/apiServices';
import { qk } from './queryClient';

export const useDebouncedValue = <T>(value: T, delayMs = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
};

const subscribeOnline = (notify: () => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
};

export const useOnlineStatus = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

/** A patient's diet chart, for doctors. One definition, so the Nutrition tab and its editor share a cache entry (each read is audited). */
export const usePatientDietPlan = (patientId: string, enabled = true) =>
  useQuery({ queryKey: qk.patientPart(patientId, 'nutrition', 'plan'), queryFn: () => nutritionService.getPatientPlan(patientId), enabled });
