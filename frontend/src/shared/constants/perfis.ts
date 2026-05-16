import type { Me, Perfil } from '@shared/api/types';

export const PERFIL_LABEL: Record<Perfil, string> = {
  gestor_solicitante: 'Gestor solicitante',
  suporte: 'Suporte',
  governador: 'Governador',
  administrador: 'Administrador',
};

export const PERFIS: { value: Perfil; label: string; descricao: string }[] = [
  {
    value: 'gestor_solicitante',
    label: 'Gestor solicitante',
    descricao: 'Cadastra e acompanha apenas as próprias solicitações.',
  },
  {
    value: 'suporte',
    label: 'Suporte',
    descricao: 'Atende, comenta, muda status e cadastra novos usuários.',
  },
  {
    value: 'governador',
    label: 'Governador',
    descricao: 'Acesso amplo de leitura, painéis e relatórios.',
  },
  {
    value: 'administrador',
    label: 'Administrador',
    descricao: 'Acesso total ao sistema, incluindo auditoria.',
  },
];

export function perfisPermitidosPara(
  perfil: Perfil | undefined,
  podeCriarUsuarios: boolean,
): Perfil[] {
  if (!perfil) return [];
  if (perfil === 'administrador') {
    return ['gestor_solicitante', 'suporte', 'governador', 'administrador'];
  }
  if (perfil === 'suporte') return ['gestor_solicitante', 'suporte'];
  if (perfil === 'governador' && podeCriarUsuarios)
    return ['gestor_solicitante', 'suporte'];
  return [];
}

export const PERFIS_OPERACIONAIS: ReadonlySet<Perfil> = new Set([
  'suporte',
  'administrador',
]);
export const PERFIS_LEITURA_GERAL: ReadonlySet<Perfil> = new Set([
  'suporte',
  'governador',
  'administrador',
]);

export function podeAcessarUsuarios(me: Pick<Me, 'perfil' | 'pode_criar_usuarios'>): boolean {
  return (
    me.perfil === 'administrador'
    || me.perfil === 'suporte'
    || (me.perfil === 'governador' && me.pode_criar_usuarios)
  );
}

export function podeCriarSolicitacao(me: Pick<Me, 'perfil' | 'pode_criar_solicitacoes'>): boolean {
  if (me.perfil === 'administrador' || me.perfil === 'gestor_solicitante') return true;
  if (me.perfil === 'suporte' || me.perfil === 'governador')
    return me.pode_criar_solicitacoes;
  return false;
}
