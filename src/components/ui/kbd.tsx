import { cn } from '@/lib/utils';

export function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border-strong bg-surface-2 px-1.5 font-mono text-[10px] font-medium text-muted',
        className,
      )}
      {...props}
    />
  );
}
