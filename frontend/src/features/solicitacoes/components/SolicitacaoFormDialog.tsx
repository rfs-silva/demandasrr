import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { messageFor } from '@shared/api/error-messages';
import type { AreaSolicitacao } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BaseInput from '@shared/components/BaseInput';
import BaseModal from '@shared/components/BaseModal';
import BaseSelect from '@shared/components/BaseSelect';
import BaseTextarea from '@shared/components/BaseTextarea';
import { useToast } from '@shared/components/ToastHost';
import { AREAS } from '@shared/constants/solicitacao';
import { uploadAnexo } from '@features/anexos/api/anexos-api';
import { useAuthStore } from '@features/auth/store';

import { useCreateSolicitacaoMutation } from '../queries/use-solicitacoes';

const AREA_VALUES = AREAS.map((a) => a.value) as [AreaSolicitacao, ...AreaSolicitacao[]];

const schema = z.object({
  titulo: z
    .string({ required_error: 'Informe um título' })
    .trim()
    .min(3, 'Mínimo de 3 caracteres')
    .max(120, 'Máximo de 120 caracteres'),
  area: z.enum(AREA_VALUES, { required_error: 'Selecione a área' }),
  descricao: z
    .string({ required_error: 'Descreva a solicitação' })
    .trim()
    .min(10, 'Mínimo de 10 caracteres')
    .max(2000, 'Máximo de 2000 caracteres'),
});

type Input = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function SolicitacaoFormDialog({ open, onClose, onSaved }: Props) {
  const me = useAuthStore((s) => s.me);
  const toast = useToast();
  const createMut = useCreateSolicitacaoMutation();

  const [arquivos, setArquivos] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<{ atual: number; total: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const ehSolicitante = me?.perfil === 'gestor_solicitante';

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
    if (open) {
      setFormError(null);
      setArquivos([]);
      setUploadStatus(null);
      reset({ titulo: '', area: undefined as never, descricao: '' });
    }
  }, [open, reset]);

  async function onSubmit(values: Input): Promise<void> {
    setFormError(null);
    try {
      const sol = await createMut.mutateAsync({
        titulo: values.titulo,
        area: values.area,
        descricao: values.descricao,
      });

      if (arquivos.length > 0) {
        const erros: string[] = [];
        setUploadStatus({ atual: 0, total: arquivos.length });
        for (let i = 0; i < arquivos.length; i++) {
          setUploadStatus({ atual: i + 1, total: arquivos.length });
          try {
            await uploadAnexo(sol.id, arquivos[i]);
          } catch (e) {
            erros.push(`${arquivos[i].name}: ${messageFor(e)}`);
          }
        }
        setUploadStatus(null);
        if (erros.length > 0) {
          toast.warning(
            `Solicitação salva, mas alguns anexos falharam (${erros.length}).`,
          );
        }
      }

      toast.success('Solicitação registrada com sucesso.');
      onSaved?.();
      onClose();
    } catch (err) {
      setUploadStatus(null);
      setFormError(messageFor(err));
    }
  }

  function onPickFiles(files: FileList | null): void {
    if (!files) return;
    setArquivos((prev) => [...prev, ...Array.from(files)]);
  }

  function removerArquivo(idx: number): void {
    setArquivos((prev) => prev.filter((_, i) => i !== idx));
  }

  const area = watch('area');

  return (
    <BaseModal
      open={open}
      onClose={isSubmitting ? () => undefined : onClose}
      title="Nova solicitação"
      description={
        ehSolicitante
          ? 'Dê um título, escolha a área e descreva o que precisa. Anexos são opcionais.'
          : 'Dê um título, escolha a área e descreva. Anexos são opcionais.'
      }
      size="lg"
      closeOnBackdrop={!isSubmitting}
      footer={
        <>
          <BaseButton variant="secondary" disabled={isSubmitting} onClick={onClose}>
            Cancelar
          </BaseButton>
          <BaseButton
            type="submit"
            form="solicitacao-form"
            loading={isSubmitting}
          >
            {arquivos.length > 0 ? 'Salvar e anexar' : 'Salvar'}
          </BaseButton>
        </>
      }
    >
      <form
        id="solicitacao-form"
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <BaseInput
          label="Título"
          placeholder="Ex.: Reforma da quadra municipal"
          maxLength={120}
          required
          error={errors.titulo?.message}
          disabled={isSubmitting}
          {...register('titulo')}
        />

        <BaseSelect
          label="Área"
          options={AREAS}
          placeholder="Selecione a área"
          required
          value={area ?? null}
          onChange={(v) => setValue('area', v as AreaSolicitacao, { shouldValidate: true })}
          error={errors.area?.message}
          disabled={isSubmitting}
        />

        <BaseTextarea
          label="Descrição"
          placeholder="Descreva a solicitação com clareza (mín. 10, máx. 2000 caracteres)"
          rows={6}
          maxLength={2000}
          required
          error={errors.descricao?.message}
          disabled={isSubmitting}
          {...register('descricao')}
        />

        {/* Anexos (opcional) */}
        <div>
          <p className="field-label">Anexos (opcional)</p>
          <label
            className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface-muted px-4 py-3 text-sm text-ink-muted transition hover:border-brand-400 hover:text-ink"
            htmlFor="file-picker"
          >
            <span>Selecionar arquivos</span>
            <input
              id="file-picker"
              type="file"
              multiple
              className="sr-only"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
              onChange={(e) => onPickFiles((e.target as HTMLInputElement).files)}
            />
          </label>
          {arquivos.length > 0 && (
            <ul className="mt-2 space-y-1">
              {arquivos.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs"
                >
                  <span className="truncate text-ink">{f.name}</span>
                  <button
                    type="button"
                    className="text-2xs font-medium text-red-600 hover:text-red-700 dark:text-red-300"
                    onClick={() => removerArquivo(i)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {uploadStatus && (
          <p
            className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-200"
            aria-live="polite"
          >
            Enviando anexo {uploadStatus.atual} de {uploadStatus.total}…
          </p>
        )}

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
