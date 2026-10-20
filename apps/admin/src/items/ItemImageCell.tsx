import { cn } from 'cn';
import { ImageOffIcon, ImagePlusIcon, Loader2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { adminImageUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { strings } from '@/strings';

const t = strings.items.image;

export type ItemImageCellProps = {
  /** The stored item; `undefined` for a row not saved yet, which cannot have an image. */
  id: string | undefined;
  /** The image's version; `undefined` when the item has none. */
  version: string | undefined;
  /** The row's name for screen readers. */
  label: string;
  /** An upload or removal of this item is in flight. */
  busy: boolean;
  /**
   * Nothing may start. Explicit, because the popover is portalled out of the page's
   * `<fieldset disabled>` and would otherwise stay live while the list is saved.
   */
  disabled: boolean;
  onPick: (file: File) => void;
  /** The page confirms first, then removes. */
  onRemove: () => void;
};

const square =
  'relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md';

/**
 * The leading cell of a permanent menu row: a dashed square to add an image, or the thumbnail, which
 * opens a popover with the large rendition, replace and remove. A thumbnail that does not load
 * (the shared development database names an image this machine's R2 lacks) shows an "image off"
 * mark; replacing and removing still work.
 */
export function ItemImageCell({
  id,
  version,
  label,
  busy,
  disabled,
  onPick,
  onRemove,
}: ItemImageCellProps) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // The URL that failed, not a flag, so a new version is tried afresh.
  const [broken, setBroken] = useState<string | null>(null);
  const thumb = id === undefined ? null : adminImageUrl({ id, imageVersion: version }, 'thumb');
  const large = id === undefined ? null : adminImageUrl({ id, imageVersion: version }, 'large');
  const missing = thumb !== null && broken === thumb;
  const pick = () => {
    setOpen(false);
    input.current?.click();
  };

  const spinner = busy && (
    <span className="absolute inset-0 flex items-center justify-center bg-background/70">
      <Loader2Icon className="size-4 animate-spin" aria-label={t.uploading} />
    </span>
  );

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      hidden
      tabIndex={-1}
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        // Cleared, so picking the same file again uploads it again.
        event.currentTarget.value = '';
        if (file) {
          onPick(file);
        }
      }}
    />
  );

  if (thumb === null) {
    return (
      <span title={id === undefined ? t.afterSave : t.add} className="shrink-0">
        <Button
          type="button"
          variant="outline"
          aria-label={t.cell(label)}
          disabled={id === undefined || disabled}
          className={cn(square, 'border-dashed p-0 text-muted-foreground')}
          onClick={pick}
        >
          <ImagePlusIcon />
          {spinner}
        </Button>
        {fileInput}
      </span>
    );
  }

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={t.cell(label)}
          disabled={disabled}
          className={cn(square, 'p-0')}
        >
          {missing ? (
            <ImageOffIcon className="text-muted-foreground" />
          ) : (
            <img
              src={thumb}
              alt=""
              className="size-full object-cover"
              onError={() => setBroken(thumb)}
            />
          )}
          {spinner}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 flex-col gap-3">
        {missing || large === null ? (
          <p className="text-muted-foreground text-sm">{t.missing}</p>
        ) : (
          <img
            src={large}
            alt={t.preview}
            className="max-h-64 w-full rounded-md bg-muted object-contain"
          />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={pick}>
            {t.replace}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
          >
            {t.remove}
          </Button>
        </div>
      </PopoverContent>
      {fileInput}
    </Popover>
  );
}
