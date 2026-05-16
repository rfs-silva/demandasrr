import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { messageFor } from '@shared/api/error-messages';
import { isApiError } from '@shared/api/errors';
import type { Pessoa, Situacao } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BaseInput from '@shared/components/BaseInput';
import BaseModal from '@shared/components/BaseModal';
import BaseSelect from '@shared/components/BaseSelect';
import { useToast } from '@shared/components/ToastHost';
import { digitsOnly, maskCpfWhileTyping } from '@shared/utils/cpf';
import MunicipioPicker from '@features/municipios/components/MunicipioPicker';

import {
  useCreatePessoaMutation,
  useUpdatePessoaMutation,
} from '../queries/use-pessoas';
import {
  pessoaCreateSchema,
  pessoaUpdateSchema,
  type PessoaCreateInput,
  type PessoaUpdateInput,
} from '../schemas';

interface Props {
  open: boolean;
  editing: Pessoa | null;
  onClose: () => void;
  onSaved?: () => void;
}

const SITUACOES: { value: Situacao; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
];

export default function PessoaFormDialog({
  open,
  editing,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  const createMut = useCreatePessoaMutation();
  const updateMut = useUpdatePessoaMutation();
  const isEdit = !!editing;
  const [formError, setFormError] = useState<string | null>(null);

  const cForm = useForm<PessoaCreateInput>({
    resolver: zodResolver(pessoaCreateSchema),
    defaultValues: {
      nome: '',
      cpf: '',
      data_nascimento: '',
      municipio_id: '',
      localidade: '',
    },
  });

  const uForm = useForm<PessoaUpdateInput>({
    resolver: zodResolver(pessoaUpdateSchema),
    defaultValues: {
      nome: '',
      data_nascimento: '',
      municipio_id: '',
      localidade: '',
      situacao: 'ativo',
    },
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (editing) {
      uForm.reset({
        nome: editing.nome,
        data_nascimento: editing.data_nascimento,
        municipio_id: editing.municipio.id,
        localidade: editing.localidade ?? '',
        situacao: editing.situacao,
      });
    } else {
      cForm.reset({
        nome: '',
        cpf: '',
        data_nascimento: '',
        municipio_id: '',
        localidade: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const onCreate = cForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createMut.mutateAsync({
        nome: values.nome,
        cpf: digitsOnly(values.cpf),
        data_nascimento: values.data_nascimento,
        municipio_id: values.municipio_id,
        localidade: values.localidade || null,
      });
      toast.success('Pessoa cadastrada.');
      onSaved?.();
      onClose();
    } catch (err) {
      setFormError(messageFor(err));
      if (isApiError(err) && err.code === 'CPF_DUPLICADO') {
        cForm.setError('cpf', { message: 'CPF já cadastrado.' });
      }
    }
  });

  const onUpdate = uForm.handleSubmit(async (values) => {
    if (!editing) return;
    setFormError(null);
    try {
      await updateMut.mutateAsync({
        id: editing.id,
        payload: {
          nome: values.nome,
          data_nascimento: values.data_nascimento,
          municipio_id: values.municipio_id,
          localidade: values.localidade || null,
          situacao: values.situacao,
        },
      });
      toast.success('Pessoa atualizada.');
      onSaved?.();
      onClose();
    } catch (err) {
      setFormError(messageFor(err));
    }
  });

  const submitting = cForm.formState.isSubmitting || uForm.formState.isSubmitting;

  return (
    <BaseModal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={isEdit ? 'Editar pessoa' : 'Nova pessoa'}
      description={
        isEdit
          ? 'CPF é imutável após o cadastro. Os demais campos podem ser ajustados.'
          : 'Cadastre uma pessoa beneficiária. O CPF é validado e único.'
      }
      size="md"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <BaseButton variant="secondary" disabled={submitting} onClick={onClose}>
            Cancelar
          </BaseButton>
          <BaseButton type="submit" form="pessoa-form" loading={submitting}>
            {isEdit ? 'Salvar' : 'Cadastrar pessoa'}
          </BaseButton>
        </>
      }
    >
      {isEdit ? (
        <form id="pessoa-form" className="space-y-4" noValidate onSubmit={onUpdate}>
          <BaseInput
            label="Nome completo"
            required
            error={uForm.formState.errors.nome?.message}
            disabled={submitting}
            {...uForm.register('nome')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BaseInput
              label="CPF"
              disabled
              value={editing?.cpf ?? ''}
              hint="CPF é imutável."
            />
            <BaseInput
              label="Data de nascimento"
              type="date"
              required
              error={uForm.formState.errors.data_nascimento?.message}
              disabled={submitting}
              {...uForm.register('data_nascimento')}
            />
          </div>
          <Controller
            control={uForm.control}
            name="municipio_id"
            render={({ field, fieldState }) => (
              <MunicipioPicker
                municipioId={field.value || null}
                localidade={uForm.watch('localidade') ?? null}
                required
                disabled={submitting}
                onChange={(id, loc) => {
                  field.onChange(id ?? '');
                  uForm.setValue('localidade', loc ?? '', { shouldValidate: true });
                }}
                error={{
                  municipio_id: fieldState.error?.message ?? null,
                  localidade: uForm.formState.errors.localidade?.message ?? null,
                }}
              />
            )}
          />
          <Controller
            control={uForm.control}
            name="situacao"
            render={({ field, fieldState }) => (
              <BaseSelect
                label="Situação"
                options={SITUACOES}
                required
                disabled={submitting}
                value={field.value ?? null}
                onChange={(v) => field.onChange((v as Situacao) ?? 'ativo')}
                error={fieldState.error?.message}
              />
            )}
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
      ) : (
        <form id="pessoa-form" className="space-y-4" noValidate onSubmit={onCreate}>
          <BaseInput
            label="Nome completo"
            required
            error={cForm.formState.errors.nome?.message}
            disabled={submitting}
            {...cForm.register('nome')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={cForm.control}
              name="cpf"
              render={({ field, fieldState }) => (
                <BaseInput
                  label="CPF"
                  inputMode="numeric"
                  maxLength={14}
                  required
                  disabled={submitting}
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(maskCpfWhileTyping((e.target as HTMLInputElement).value))
                  }
                  error={fieldState.error?.message}
                />
              )}
            />
            <BaseInput
              label="Data de nascimento"
              type="date"
              required
              error={cForm.formState.errors.data_nascimento?.message}
              disabled={submitting}
              {...cForm.register('data_nascimento')}
            />
          </div>
          <Controller
            control={cForm.control}
            name="municipio_id"
            render={({ field, fieldState }) => (
              <MunicipioPicker
                municipioId={field.value || null}
                localidade={cForm.watch('localidade') ?? null}
                required
                disabled={submitting}
                onChange={(id, loc) => {
                  field.onChange(id ?? '');
                  cForm.setValue('localidade', loc ?? '', { shouldValidate: true });
                }}
                error={{
                  municipio_id: fieldState.error?.message ?? null,
                  localidade: cForm.formState.errors.localidade?.message ?? null,
                }}
              />
            )}
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
      )}
    </BaseModal>
  );
}
