import { useCallback, useState } from 'react';

// "I couldn't do this today" is kept on this device only: the Exercise API can record a
// completion but not a skip, so the care team still sees the exercise as not done.
// ponytail: localStorage per device; move to the API once it accepts a SKIPPED completion
const PREFIX = 'ffs_skips_';

export type Skips = Record<string, string>; // itemId -> reason

const keyFor = (patientId: string, date: string) => `${PREFIX}${patientId}_${date}`;

/** Today's skips for this patient. Older days are removed on the way. */
export const readSkips = (patientId: string, date: string): Skips => {
  try {
    const today = keyFor(patientId, date);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${PREFIX}${patientId}_`) && key !== today) localStorage.removeItem(key);
    }
    return JSON.parse(localStorage.getItem(today) ?? '{}') as Skips;
  } catch {
    return {};
  }
};

export const writeSkips = (patientId: string, date: string, skips: Skips) => {
  try {
    if (Object.keys(skips).length) localStorage.setItem(keyFor(patientId, date), JSON.stringify(skips));
    else localStorage.removeItem(keyFor(patientId, date));
  } catch {
    // Private mode or storage full: the skip just isn't remembered
  }
};

/** On sign-out, so the next person on a shared device sees nothing. */
export const clearAllSkips = () => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Nothing stored
  }
};

export const useSkips = (patientId: string, date: string) => {
  const [skips, setSkips] = useState<Skips>(() => readSkips(patientId, date));
  const update = useCallback(
    (next: Skips) => {
      writeSkips(patientId, date, next);
      setSkips(next);
    },
    [patientId, date]
  );
  return {
    skips,
    skip: (itemId: string, reason: string) => update({ ...skips, [itemId]: reason }),
    unskip: (itemId: string) => {
      const { [itemId]: _removed, ...rest } = skips;
      update(rest);
    },
  };
};
