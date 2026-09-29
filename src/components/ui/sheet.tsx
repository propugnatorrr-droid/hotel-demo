'use client';

import { X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { useRef } from 'react';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

/**
 * Right-hand drawer on desktop, iOS-style bottom sheet on phones: rounded top, grab handle,
 * swipe down to dismiss with rubber-band resistance and a haptic tick when it lets go.
 */
export function SheetContent({
  className,
  children,
  closeLabel = 'Close',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { closeLabel?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; id: number } | null>(null);

  function start(e: React.PointerEvent<HTMLDivElement>) {
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    drag.current = { y: e.clientY, t: performance.now(), id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (el.current) el.current.style.transition = 'none';
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || !el.current) return;
    const dy = e.clientY - d.y;
    // Rubber band when pulled up, 1:1 when pulled down.
    el.current.style.transform = `translateY(${dy > 0 ? dy : dy / 6}px)`;
  }
  function end(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    const node = el.current;
    if (!d || !node) return;
    const dy = e.clientY - d.y;
    const v = dy / Math.max(1, performance.now() - d.t); // px per ms
    node.style.transition = 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)';
    if (dy > 110 || v > 0.6) {
      haptic('light');
      node.style.transform = 'translateY(105%)';
      window.setTimeout(() => node.querySelector<HTMLButtonElement>('[data-sheet-close]')?.click(), 180);
    } else {
      node.style.transform = '';
    }
  }

  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="motion-overlay fixed inset-0 z-50 bg-ionian-950/30 backdrop-blur-[2px]" />
      <SheetPrimitive.Content
        ref={el}
        className={cn(
          'motion-sheet fixed z-50 flex flex-col bg-surface shadow-float focus:outline-none',
          // phone: bottom sheet
          'inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-[28px] border-t border-border pb-[env(safe-area-inset-bottom)] max-md:max-w-none!',
          // desktop: right drawer
          'max-w-md md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:rounded-none md:border-t-0 md:border-l md:pb-0',
          className,
        )}
        {...props}
      >
        <div
          data-sheet-grab
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="sticky top-0 z-10 -mb-2 flex h-7 shrink-0 cursor-grab touch-none items-end justify-center pb-1 md:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-border-strong" />
        </div>
        {children}
        <SheetPrimitive.Close
          data-sheet-close
          className="absolute top-3 right-3 z-20 grid size-9 place-items-center rounded-full bg-surface-2/80 text-subtle backdrop-blur transition-colors hover:bg-surface-3 hover:text-foreground md:top-4 md:right-4 md:size-8 md:bg-transparent"
        >
          <X className="size-4" />
          <span className="sr-only">{closeLabel}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 border-b border-border p-6 pr-14', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('font-display text-3xl', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('text-sm text-muted', className)} {...props} />;
}
