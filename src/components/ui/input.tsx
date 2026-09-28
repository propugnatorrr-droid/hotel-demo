import { cn } from '@/lib/utils';

const field =
  'w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle shadow-[inset_0_1px_1px_hsl(var(--shadow-color)/0.04)] transition-[border-color,box-shadow] duration-150 focus-visible:border-ionian-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:opacity-50 aria-invalid:border-danger';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input data-slot="input" className={cn(field, 'h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(field, 'min-h-24 resize-y py-2.5 leading-relaxed', className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label data-slot="label" className={cn('text-xs font-medium tracking-wide text-muted', className)} {...props} />;
}
