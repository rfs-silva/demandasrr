import clsx from 'clsx';

import type { StatusSolicitacao } from '@shared/api/types';
import { STATUS_BADGE, STATUS_LABEL } from '@shared/constants/solicitacao';

interface Props {
  status: StatusSolicitacao;
  className?: string;
}

export default function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium',
        STATUS_BADGE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
