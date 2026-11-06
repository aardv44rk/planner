import { useCallback, useEffect, useRef, useState } from 'react';

type Submission = () => Promise<unknown> | void;

/**
 * Prevents double-submissions during async actions.
 * State updates render asynchronously, so the ref synchronously blocks
 * subsequent clicks in the same event loop frame.
 */
export function useSubmissionGuard() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (submission: Submission): Promise<boolean> => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await submission();
      return true;
    } catch (cause: any) {
      const msg = cause?.message || (typeof cause === 'string' ? cause : 'Operation failed');
      setError(msg);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, error, run, resetError: () => setError(null) };
}

/**
 * Guards dirty editors (notes, assignment drafts) against accidental page closing or navigation.
 */
export function useDirtyGuard(isDirty: boolean, warningMessage = 'You have unsaved changes. Are you sure you want to leave?') {
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = warningMessage;
      return warningMessage;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, warningMessage]);
}
