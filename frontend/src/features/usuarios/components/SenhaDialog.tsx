import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import { messageFor } from '@shared/api/error-messages';
import type { Usuario } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BaseModal from '@shared/components/BaseModal';
import { useToast } from '@shared/components/ToastHost';

import { useChangeSenhaMutation } from '../queries/use-usuarios';

interface Props {
  open: boolean;
  target: Usuario | null;
  onClose: () => void;
}

export default function SenhaDialog({ open, target, onClose }: Props) {
  const toast = useToast();
  const mut = useChangeSenhaMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const isSubmitting = mut.isPending;

  async function onSubmit(): Promise<void> {
    if (!target) return;
    setFormError(null);
    try {
      await mut.mutateAsync({ id: target.id });
      toast.success(`Senha de ${target.nome} resetada para os 4 últimos dígitos do CPF.`);
      onClose();
    } catch (e) {
      setFormError(messageFor(e));
    }
  }

  return (
    <BaseModal
      open={open}
      onClose={isSubmitting ? () => undefined : onClose}
      title={target ? `Resetar senha — ${target.nome}` : 'Resetar senha'}
      description="Deseja resetar a senha deste usuário?"
      size="sm"
      closeOnBackdrop={!isSubmitting}
      footer={
        <>
          <BaseButton variant="secondary" disabled={isSubmitting} onClick={onClose}>
            Cancelar
          </BaseButton>
          <BaseButton onClick={() => void onSubmit()} loading={isSubmitting}>
            <KeyRound className="h-4 w-4" />
            Resetar senha
          </BaseButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          Ao confirmar, a senha será resetada para os 4 últimos dígitos do CPF e o
          usuário será obrigado a trocá-la no próximo acesso.
        </p>
        {formError && (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100"
          >
            {formError}
          </p>
        )}
      </div>
    </BaseModal>
  );
}
