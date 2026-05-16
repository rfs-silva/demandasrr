/**
 * Tipos compartilhados que espelham os contratos do backend FastAPI.
 * Mantidos manualmente — quando o backend mudar, atualize aqui também.
 * (Futuro: gerar via `openapi-typescript` a partir de /api/openapi.json.)
 */

export interface ApiEnvelope<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiMeta {
  page: number;
  page_size: number;
  total: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

/* ---- Auth ---- */
export interface Token {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export type Perfil = 'gestor_solicitante' | 'suporte' | 'governador' | 'administrador';
export type Situacao = 'ativo' | 'inativo';

export interface Me {
  id: string;
  nome: string;
  login: string;
  perfil: Perfil;
  contato: string | null;
  must_change_password: boolean;
  eh_root: boolean;
  pode_criar_usuarios: boolean;
  pode_criar_solicitacoes: boolean;
  pode_reabrir_solicitacoes: boolean;
  ver_status_solicitacao: boolean;
  pessoa_id: string | null;
}

/* ---- Município ---- */
export interface Municipio {
  id: string;
  nome: string;
  eh_outros: boolean;
}

/* ---- Pessoa ---- */
export interface Pessoa {
  id: string;
  nome: string;
  cpf: string;
  data_nascimento: string | null;
  municipio: Municipio;
  localidade: string | null;
  situacao: Situacao;
  created_at: string;
  updated_at: string;
}

/* ---- Solicitação ---- */
export type AreaSolicitacao =
  | 'gestao_economia'
  | 'desenvolvimento_sustentavel'
  | 'saude'
  | 'bem_estar'
  | 'educacao'
  | 'seguranca'
  | 'infraestrutura'
  | 'ciencia_tecnologia';

export type StatusSolicitacao =
  | 'cadastrada'
  | 'em_analise'
  | 'atendida'
  | 'indeferida'
  | 'cancelada';

export interface PessoaResumo {
  id: string;
  nome: string;
  cpf: string;
}

export interface UsuarioResumo {
  id: string;
  nome: string;
  login: string;
}

export interface Solicitacao {
  id: string;
  codigo: string;
  pessoa: PessoaResumo;
  usuario: UsuarioResumo;
  municipio: string;
  titulo: string;
  area: AreaSolicitacao;
  descricao: string;
  status: StatusSolicitacao;
  data_solicitacao: string;
  qtd_anexos: number;
  created_at: string;
  updated_at: string;
}

export type TipoEventoSolicitacao =
  | 'criada'
  | 'status_alterado'
  | 'editada'
  | 'comentario'
  | 'anexo_adicionado'
  | 'anexo_removido';

export interface SolicitacaoEvento {
  id: string;
  tipo: TipoEventoSolicitacao;
  de_status: StatusSolicitacao | null;
  para_status: StatusSolicitacao | null;
  comentario: string | null;
  interno: boolean;
  usuario: UsuarioResumo;
  created_at: string;
}

/* ---- Anexos ---- */
export interface Anexo {
  id: string;
  filename_original: string;
  content_type: string;
  tamanho_bytes: number;
  usuario: UsuarioResumo;
  created_at: string;
}

/* ---- Usuário ---- */
export interface Usuario {
  id: string;
  nome: string;
  login: string;
  cpf: string | null;
  perfil: Perfil;
  situacao: Situacao;
  municipio: Municipio | null;
  localidade: string | null;
  contato: string | null;
  data_nascimento: string | null;
  must_change_password: boolean;
  eh_root: boolean;
  pode_criar_usuarios: boolean;
  pode_criar_solicitacoes: boolean;
  pode_reabrir_solicitacoes: boolean;
  ver_status_solicitacao: boolean;
  ultimo_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsuarioCriado {
  usuario: Usuario;
  senha_temporaria: string;
}

/* ---- Auditoria ---- */
export type AcaoAudit =
  | 'login_sucesso'
  | 'login_falhou'
  | 'logout'
  | 'senha_propria_alterada'
  | 'usuario_criado'
  | 'usuario_atualizado'
  | 'usuario_inativado'
  | 'usuario_senha_resetada'
  | 'solicitacao_criada'
  | 'solicitacao_editada'
  | 'solicitacao_status_alterado'
  | 'solicitacao_comentario'
  | 'anexo_upload'
  | 'anexo_removido';

export type EntidadeAudit = 'usuario' | 'solicitacao' | 'anexo' | 'sistema';

export interface AuditLog {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_login: string | null;
  actor_nome: string | null;
  actor_perfil: string | null;
  acao: AcaoAudit;
  entidade: EntidadeAudit;
  entidade_id: string | null;
  entidade_label: string | null;
  detalhes: Record<string, unknown> | null;
  ip: string | null;
}
