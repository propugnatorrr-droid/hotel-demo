import { cn } from '@/lib/utils';

const TONES = [
  'bg-ionian-100 text-ionian-800',
  'bg-olive-100 text-olive-700',
  'bg-terracotta-100 text-terracotta-700',
  'bg-gold-100 text-gold-500',
  'bg-limestone-200 text-limestone-800',
] as const;

const SIZES = {
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-xs',
  lg: 'size-12 text-sm',
} as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

function toneFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

type AvatarProps = {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
};

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium ring-1 ring-border select-none',
        SIZES[size],
        !src && toneFor(name),
        className,
      )}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
