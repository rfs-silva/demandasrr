import { CloudUpload, FileUp, X } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';

import { messageFor } from '@shared/api/error-messages';
import BaseButton from '@shared/components/BaseButton';
import { useToast } from '@shared/components/ToastHost';
import { formatBytes } from '@shared/utils/bytes';

import { useUploadAnexoMutation } from '../queries/use-anexos';

interface Props {
  solicitacaoId: string;
  onUploaded?: () => void;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx';
const MAX_MB = 10;

export default function AnexoUploader({ solicitacaoId, onUploaded }: Props) {
  const toast = useToast();
  const mut = useUploadAnexoMutation(solicitacaoId);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [current, setCurrent] = useState<File | null>(null);

  function openPicker(): void {
    inputRef.current?.click();
  }

  async function handleFiles(files: FileList | File[] | null): Promise<void> {
    if (!files) return;
    const list = Array.from(files);
    const file = list[0];
    if (!file) return;

    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Tamanho máximo: ${MAX_MB} MB.`);
      return;
    }

    setCurrent(file);
    setProgress({ loaded: 0, total: file.size });
    try {
      await mut.mutateAsync({
        file,
        onProgress: (p) => setProgress(p),
      });
      toast.success(`"${file.name}" anexado.`);
      onUploaded?.();
    } catch (err) {
      toast.error(messageFor(err));
    } finally {
      setProgress(null);
      setCurrent(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function onDrop(ev: DragEvent): void {
    ev.preventDefault();
    setDragging(false);
    if (ev.dataTransfer?.files) void handleFiles(ev.dataTransfer.files);
  }

  function onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    setDragging(true);
  }

  function onDragLeave(): void {
    setDragging(false);
  }

  const pct =
    progress && progress.total
      ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
      : 0;

  return (
    <div>
      <label
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition',
          dragging
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
            : 'border-border bg-surface-muted hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-900/10',
        ].join(' ')}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={openPicker}
      >
        <CloudUpload className="h-7 w-7 text-brand-600" aria-hidden />
        <p className="text-sm font-medium text-ink">
          Arraste um arquivo aqui ou{' '}
          <span className="text-brand-700 underline">clique para selecionar</span>
        </p>
        <p className="text-xs text-ink-muted">
          PDF, imagens (JPG, PNG, WebP), Word (.docx) e Excel (.xlsx) · máx. {MAX_MB} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPT}
          onChange={(e) => handleFiles((e.target as HTMLInputElement).files)}
        />
      </label>

      {current && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          <FileUp className="h-4 w-4 flex-none text-ink-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{current.name}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
              <div
                className="h-full bg-brand-600 transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-0.5 text-2xs text-ink-muted">
              {formatBytes(progress?.loaded ?? 0)} / {formatBytes(current.size)} · {pct}%
            </p>
          </div>
          {!mut.isPending && (
            <BaseButton
              variant="ghost"
              size="sm"
              aria-label="Cancelar"
              onClick={() => setCurrent(null)}
            >
              <X className="h-4 w-4" />
            </BaseButton>
          )}
        </div>
      )}
    </div>
  );
}
