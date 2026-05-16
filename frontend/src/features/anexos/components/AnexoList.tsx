import {
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { useState, type ComponentType } from 'react';

import { messageFor } from '@shared/api/error-messages';
import type { Anexo } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import EmptyState from '@shared/components/EmptyState';
import { useToast } from '@shared/components/ToastHost';
import { formatBytes } from '@shared/utils/bytes';
import { useAuthStore } from '@features/auth/store';

import { downloadAnexo } from '../api/anexos-api';
import { useDeleteAnexoMutation } from '../queries/use-anexos';

interface Props {
  solicitacaoId: string;
  anexos: Anexo[] | undefined;
  loading?: boolean;
}

function iconFor(contentType: string): ComponentType<{ className?: string }> {
  if (contentType.startsWith('image/')) return FileImage;
  if (contentType === 'application/pdf') return FileText;
  if (contentType.includes('spreadsheet')) return FileSpreadsheet;
  return FileText;
}

function colorFor(contentType: string): string {
  if (contentType.startsWith('image/'))
    return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200';
  if (contentType === 'application/pdf')
    return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200';
  if (contentType.includes('spreadsheet'))
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-100';
}

export default function AnexoList({ solicitacaoId, anexos, loading }: Props) {
  const me = useAuthStore((s) => s.me);
  const toast = useToast();
  const removeMut = useDeleteAnexoMutation(solicitacaoId);
  const [downloading, setDownloading] = useState<string | null>(null);

  function podeRemover(a: Anexo): boolean {
    // Cada anexo só pode ser removido por quem o enviou — vale para todos os
    // perfis. Preserva integridade dos uploads do solicitante.
    if (!me) return false;
    return a.usuario.id === me.id;
  }

  async function baixar(a: Anexo): Promise<void> {
    setDownloading(a.id);
    try {
      await downloadAnexo(solicitacaoId, a.id, a.filename_original);
    } catch (e) {
      toast.error(messageFor(e));
    } finally {
      setDownloading(null);
    }
  }

  async function remover(a: Anexo): Promise<void> {
    if (!window.confirm(`Remover o anexo "${a.filename_original}"?`)) return;
    try {
      await removeMut.mutateAsync(a.id);
      toast.success('Anexo removido.');
    } catch (e) {
      toast.error(messageFor(e));
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
            <BaseSkeleton width="2.25rem" height="2.25rem" rounded="md" />
            <div className="flex-1 space-y-1">
              <BaseSkeleton width="40%" />
              <BaseSkeleton width="25%" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!anexos || anexos.length === 0) {
    return <EmptyState icon={Paperclip} title="Sem anexos" />;
  }

  return (
    <ul className="space-y-2">
      {anexos.map((a) => {
        const Icon = iconFor(a.content_type);
        return (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <span
              className={`grid h-9 w-9 flex-none place-items-center rounded-md ${colorFor(a.content_type)}`}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {a.filename_original}
              </p>
              <p className="truncate text-2xs text-ink-muted">
                {formatBytes(a.tamanho_bytes)} · por {a.usuario.nome}
              </p>
            </div>
            <div className="flex flex-none items-center gap-1">
              <BaseButton
                variant="ghost"
                size="sm"
                aria-label="Baixar"
                loading={downloading === a.id}
                onClick={() => baixar(a)}
              >
                <Download className="h-4 w-4" />
              </BaseButton>
              {podeRemover(a) && (
                <BaseButton
                  variant="ghost"
                  size="sm"
                  aria-label="Remover"
                  onClick={() => remover(a)}
                >
                  <Trash2 className="h-4 w-4 text-red-600 dark:text-red-300" />
                </BaseButton>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
