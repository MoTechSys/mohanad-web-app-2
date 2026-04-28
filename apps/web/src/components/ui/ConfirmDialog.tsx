import { type ReactNode } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';

/**
 * ConfirmDialog — small wrapper around <Modal> for yes/no decisions.
 *
 * Defaults to a danger-styled confirm button (since most uses are destructive
 * actions); switch to `intent='primary'` for benign confirmations.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: 'primary' | 'danger';
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  intent = 'danger',
  isLoading,
  onConfirm,
  onClose,
}: ConfirmDialogProps): JSX.Element {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {message ? <p className="text-sm text-gray-600">{message}</p> : null}
      <div className="mt-5 flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button variant={intent} onClick={onConfirm} isLoading={isLoading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
