import { z } from 'zod';

import { digitsOnly, isValidCpf } from '@shared/utils/cpf';

const cpfField = z
  .string({ required_error: 'Informe o CPF' })
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 11, 'CPF deve ter 11 dígitos')
  .refine(isValidCpf, 'CPF inválido');

const SITUACAO = ['ativo', 'inativo'] as const;

const dataNasc = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
  .refine((v) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return false;
    return d.getFullYear() >= 1900 && d <= new Date();
  }, 'Data de nascimento inválida')
  .optional()
  .or(z.literal(''));

export const pessoaCreateSchema = z.object({
  nome: z.string().trim().min(3, 'Nome muito curto').max(150, 'Nome muito longo'),
  cpf: cpfField,
  data_nascimento: dataNasc,
  municipio_id: z
    .string({ required_error: 'Selecione o município' })
    .uuid('Município inválido'),
  localidade: z.string().trim().max(200).optional().or(z.literal('')),
});
export type PessoaCreateInput = z.input<typeof pessoaCreateSchema>;

export const pessoaUpdateSchema = z.object({
  nome: z.string().trim().min(3, 'Nome muito curto').max(150, 'Nome muito longo'),
  data_nascimento: dataNasc,
  municipio_id: z
    .string({ required_error: 'Selecione o município' })
    .uuid('Município inválido'),
  localidade: z.string().trim().max(200).optional().or(z.literal('')),
  situacao: z.enum(SITUACAO),
});
export type PessoaUpdateInput = z.input<typeof pessoaUpdateSchema>;
