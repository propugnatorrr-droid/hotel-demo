import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    tone: {
      neutral: 'bg-surface-2 text-muted',
      success: 'bg-success-soft text-success',
      danger: 'bg-danger-soft text-danger',
      accent: 'bg-accent-soft text-accent',
      info: 'bg-ionian-100 text-ionian-700 dark:bg-ionian-900 dark:text-ionian-200',
      outline: 'border border-border-strong text-muted',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { dot?: boolean; color?: string };

/** `color` = any CSS color (e.g. var(--color-ch-booking)) for channel badges */
export function Badge({ className, tone, dot, color, style, children, ...props }: BadgeProps) {
  const custom = color
    ? { backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`, color, ...style }
    : style;
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} style={custom} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
