import { useCallback, useState } from 'react';

export type ToastMessage = {
  id: number;
  text: string;
};

const TOAST_DURATION_MS = 2500;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  return { toasts, addToast };
}
