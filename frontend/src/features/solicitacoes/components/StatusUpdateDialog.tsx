import { useEffect, useMemo, useState } from 'react';

import type { StatusSolicitacao } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BaseModal from '@shared/components/BaseModal';
import { STATUS_LABEL } from '@shared/constants/solicitacao';

interface Props {
  open: boolean;
  currentStatus: StatusSolicitacao | null;
  nextStatus: StatusSolicitacao | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (parecer: string) => Promise<void> | void;
}

function isParecerObrigatorio(status: StatusSolicitacao | null): boolean {
  return status === 'indeferida' || status === 'cancelada';
}

export default function StatusUpdateDialog({
  open,
  currentStatus,
  nextStatus,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const [parecer, setParecer] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setParecer('');
      setError(null);
    }
  }, [open, currentStatus, nextStatus]);

  const obrigatorio = isParecerObrigatorio(nextStatus);
  const isReabertura = currentStatus === 'cancelada' && nextStatus === 'em_analise';

  const title = useMemo(() => {
    if (!nextStatus) return 'Atualizar status';
    if (isReabertura) return 'Reabrir solicitação';
    return `Alterar para ${STATUS_LABEL[nextStatus]}`;
  }, [isReabertura, nextStatus]);

  const description = isReabertura
    ? 'A demanda cancelada voltará para em análise. Você pode registrar um parecer de reabertura.'
    : obrigatorio
      ? 'Informe o parecer para concluir esta alteração de status.'
      : 'Se necessário, registre um parecer para contextualizar a movimentação.';

  async function handleConfirm(): Promise<void> {
    const texto = parecer.trim();
    if (obrigatorio && !texto) {
      setError('Informe o parecer para continuar.');
      return;
    }
    setError(null);
    await onConfirm(texto);
  }

  return (
    <BaseModal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <BaseButton variant="secondary" disabled={loading} onClick={onClose}>
            Cancelar
          </BaseButton>
          <BaseButton loading={loading} onClick={() => void handleConfirm()}>
            Confirmar
          </BaseButton>
        </>
      }
    >
      <div className="space-y-3">
        <label htmlFor="status-parecer" className="field-label">
          {obrigatorio ? 'Parecer obrigatório' : isReabertura ? 'Parecer da reabertura (opcional)' : 'Parecer (opcional)'}
        </label>
        <textarea
          id="status-parecer"
          value={parecer}
          onChange={(e) => setParecer(e.target.value)}
          rows={5}
          maxLength={1000}
          placeholder={obrigatorio ? 'Descreva o motivo desta decisão.' : 'Adicione um contexto para a equipe, se necessário.'}
          className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <div className="flex items-center justify-between gap-3 text-xs text-ink-subtle">
          <span>
            {currentStatus && nextStatus
              ? `${STATUS_LABEL[currentStatus]} -> ${STATUS_LABEL[nextStatus]}`
              : 'Mudança de status'}
          </span>
          <span>{parecer.trim().length}/1000</span>
        </div>
        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100">
            {error}
          </p>
        )}
      </div>
    </BaseModal>
  );
}