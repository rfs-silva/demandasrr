import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { messageFor } from '@shared/api/error-messages';
import type { AreaSolicitacao, Solicitacao } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BaseInput from '@shared/components/BaseInput';
import BaseModal from '@shared/components/BaseModal';
import BaseSelect from '@shared/components/BaseSelect';
import BaseTextarea from '@shared/components/BaseTextarea';
import { useToast } from '@shared/components/ToastHost';
import { AREAS } from '@shared/constants/solicitacao';

import { useUpdateSolicitacaoMutation } from '../queries/use-solicitacoes';

const AREA_VALUES = AREAS.map((a) => a.value) as [AreaSolicitacao, ...AreaSolicitacao[]];

const schema = z.object({
  titulo: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(120, 'Máximo de 120 caracteres'),
  area: z.enum(AREA_VALUES),
  descricao: z.string().trim().min(10, 'Mínimo de 10 caracteres').max(2000, 'Máximo de 2000 caracteres'),
});

type Input = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  solicitacao: Solicitacao | null;
  onSaved?: () => void;
}

export default function SolicitacaoEditarDialog({
  open,
  onClose,
  solicitacao,
  onSaved,
}: Props) {
  const toast = useToast();
  const mut = useUpdateSolicitacaoMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Input>({
    resolver: zodResolver(schema),
    defaultValues: { titulo: '', area: undefined as never, descricao: '' },
  });

  useEffect(() => {
    if (!open || !solicitacao) return;
    setFormError(null);
    reset({
      titulo: solicitacao.titulo,
      area: solicitacao.area,
      descricao: solicitacao.descricao,
    });
  }, [open, solicitacao, reset]);

  async function onSubmit(values: Input): Promise<void> {
    if (!solicitacao) return;
    setFormError(null);
    try {
      await mut.mutateAsync({
        id: solicitacao.id,
        payload: {
          titulo: values.titulo,
          area: values.area,
          descricao: values.descricao,
        },
      });
      toast.success('Solicitação atualizada.');
      onSaved?.();
      onClose();
    } catch (err) {
      setFormError(messageFor(err));
    }
  }

  const area = watch('area');

  return (
    <BaseModal
      open={open}
      onClose={isSubmitting ? () => undefined : onClose}
      title="Editar solicitação"
      description="Você pode ajustar o título, a área e a descrição enquanto a solicitação está cadastrada. A edição fica registrada no histórico."
      size="lg"
      closeOnBackdrop={!isSubmitting}
      footer={
        <>
          <BaseButton variant="secondary" disabled={isSubmitting} onClick={onClose}>
            Cancelar
          </BaseButton>
          <BaseButton type="submit" form="solicitacao-editar-form" loading={isSubmitting}>
            Salvar
          </BaseButton>
        </>
      }
    >
      <form
        id="solicitacao-editar-form"
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <BaseInput
          label="Título"
          maxLength={120}
          required
          error={errors.titulo?.message}
          disabled={isSubmitting}
          {...register('titulo')}
        />

        <BaseSelect
          label="Área"
          options={AREAS}
          required
          value={area ?? null}
          onChange={(v) => setValue('area', v as AreaSolicitacao, { shouldValidate: true })}
          error={errors.area?.message}
          disabled={isSubmitting}
        />

        <BaseTextarea
          label="Descrição"
          rows={6}
          maxLength={2000}
          required
          error={errors.descricao?.message}
          disabled={isSubmitting}
          {...register('descricao')}
        />

        {formError && (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100"
          >
            {formError}
          </p>
        )}
      </form>
    </BaseModal>
  );
}
