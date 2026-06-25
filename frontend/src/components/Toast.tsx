import { createPortal } from 'react-dom';
import type { ToastMessage } from '../queue/useToast';

type ToastContainerProps = {
  toasts: ToastMessage[];
};

export default function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toastContainer" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  );
}
