import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  icon: LucideIcon;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'up' | 'down' | 'neutral';
  className?: string;
};

export function KpiCard({ label, icon: Icon, value, sub, tone = 'neutral', className }: Props) {
  return (
    <Card className={cn('animate-fade-up group relative overflow-hidden p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors duration-200 group-hover:text-foreground">
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className="font-display mt-4 text-4xl md:text-[2.75rem]">{value}</div>
      {sub && (
        <p
          className={cn(
            'mt-2 text-xs',
            tone === 'up' && 'text-success',
            tone === 'down' && 'text-danger',
            tone === 'neutral' && 'text-subtle',
          )}
        >
          {sub}
        </p>
      )}
    </Card>
  );
}
