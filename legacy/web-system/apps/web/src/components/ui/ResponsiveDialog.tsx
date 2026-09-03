import { type ReactNode } from 'react';

import { useIsDesktop } from '@/hooks/useResponsive';
import { BottomSheet } from './BottomSheet';
import { Modal, type ModalProps } from './Modal';

/**
 * ResponsiveDialog — picks <Modal> on desktop (≥ 768 px) and <BottomSheet>
 * on mobile, matching the design system's 768 px breakpoint convention.
 *
 * Passes the same `open / onClose / title / children` props through to the
 * underlying primitive. `description` and `size` are ignored on the
 * BottomSheet variant (no equivalent affordance).
 */
export interface ResponsiveDialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: ModalProps['size'];
}

export function ResponsiveDialog({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: ResponsiveDialogProps): JSX.Element {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title={title} description={description} size={size}>
        {children}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {children}
    </BottomSheet>
  );
}
