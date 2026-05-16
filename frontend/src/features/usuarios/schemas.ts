import { z } from 'zod';

import { digitsOnly, isValidCpf } from '@shared/utils/cpf';

const cpfField = z
  .string({ required_error: 'Informe o CPF' })
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 11, 'CPF deve ter 11 dígitos')
  .refine(isValidCpf, 'CPF inválido');

const PERFIL = ['gestor_solicitante', 'suporte', 'governador', 'administrador'] as const;
const SITUACAO = ['ativo', 'inativo'] as const;

const senhaForte = z
  .string()
  .min(6, 'Mínimo de 6 caracteres')
  .max(128, 'Senha muito longa')
  .refine((s) => /[a-zA-Z]/.test(s) && /\d/.test(s), {
    message: 'Inclua letras e números',
  });

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
  .optional()
  .or(z.literal(''));

export const usuarioCreateSchema = z.object({
  nome: z.string().trim().min(3, 'Nome muito curto').max(150, 'Nome muito longo'),
  cpf: cpfField,
  municipio_id: z
    .string({ required_error: 'Selecione o município' })
    .uuid('Município inválido'),
  perfil: z.enum(PERFIL, { required_error: 'Selecione o perfil' }),
  localidade: z.string().trim().max(200).optional().or(z.literal('')),
  contato: z.string().trim().max(50).optional().or(z.literal('')),
  data_nascimento: dataIso,
  pode_criar_usuarios: z.boolean().optional(),
  pode_criar_solicitacoes: z.boolean().optional(),
  pode_reabrir_solicitacoes: z.boolean().optional(),
  ver_status_solicitacao: z.boolean().optional(),
});
export type UsuarioCreateInput = z.input<typeof usuarioCreateSchema>;

export const usuarioUpdateSchema = z.object({
  nome: z.string().trim().min(3, 'Nome muito curto').max(150, 'Nome muito longo'),
  perfil: z.enum(PERFIL),
  situacao: z.enum(SITUACAO),
  contato: z.string().trim().max(50).optional().or(z.literal('')),
  data_nascimento: dataIso,
  pode_criar_usuarios: z.boolean().optional(),
  pode_criar_solicitacoes: z.boolean().optional(),
  pode_reabrir_solicitacoes: z.boolean().optional(),
  ver_status_solicitacao: z.boolean().optional(),
});
export type UsuarioUpdateInput = z.input<typeof usuarioUpdateSchema>;

export const senhaChangeSchema = z
  .object({ senha: senhaForte, confirmacao: z.string() })
  .refine((d) => d.senha === d.confirmacao, {
    message: 'A confirmação não confere',
    path: ['confirmacao'],
  });
export type SenhaChangeInput = z.input<typeof senhaChangeSchema>;
