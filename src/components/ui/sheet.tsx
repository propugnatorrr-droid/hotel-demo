'use client';

import { X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

export function SheetContent({
  className,
  children,
  closeLabel = 'Close',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { closeLabel?: string }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="motion-overlay fixed inset-0 z-50 bg-ionian-950/30 backdrop-blur-[2px]" />
      <SheetPrimitive.Content
        className={cn(
          'motion-sheet fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-float focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-sm p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">{closeLabel}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 border-b border-border p-6 pr-12', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('font-display text-3xl', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('text-sm text-muted', className)} {...props} />;
}
