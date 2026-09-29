'use client';

import { ArrowRight, CornerDownLeft, Search, Sparkles, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { AskPanel } from '@/components/app/ask-panel';
import { NAV } from '@/config/navigation';
import { useRouter } from '@/i18n/navigation';
import type { Currency } from '@/lib/format';
import { cn } from '@/lib/utils';

const EVENT = 'iliria:command';

export function openCommandBar() {
  window.dispatchEvent(new Event(EVENT));
}

/** Diacritic-insensitive: "e" matches "ë", "c" matches "ç" */
const normalize = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

type Row =
  | { kind: 'ask'; id: 'ask'; label: string }
  | { kind: 'nav'; id: string; label: string; href: string; Icon: LucideIcon };

export function CommandBar({ navKeys, aiMode, locale, currency }: { navKeys: string[]; aiMode: 'owner' | 'staff' | null; locale: string; currency: Currency }) {
  const t = useTranslations('command');
  const tNav = useTranslations('nav.items');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [asked, setAsked] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(EVENT, onOpen);
    };
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery('');
      setAsked(null);
      setActive(0);
    }
  }, []);

  const rows = useMemo<Row[]>(() => {
    const q = normalize(query);
    const nav: Row[] = NAV.filter((i) => navKeys.includes(i.key))
      .map((i) => ({ kind: 'nav' as const, id: i.key, label: tNav(i.key), href: i.href, Icon: i.icon }))
      .filter((r) => !q || normalize(r.label).includes(q) || r.id.includes(q));
    return q ? [{ kind: 'ask', id: 'ask', label: query.trim() }, ...nav] : nav;
  }, [query, navKeys, tNav]);

  useEffect(() => setActive(0), [query]);

  const select = useCallback(
    (row: Row) => {
      if (row.kind === 'ask') {
        setAsked(row.label);
        return;
      }
      onOpenChange(false);
      router.push(row.href);
    },
    [onOpenChange, router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[active];
      if (row) select(row);
    }
  };

  const suggestions = [t('s1'), t('s2'), t('s3')];
  const navRows = rows.filter((r) => r.kind === 'nav');
  const askRow = rows.find((r) => r.kind === 'ask');

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="motion-overlay fixed inset-0 z-50 bg-ionian-950/40 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="motion-dialog fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-float focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{t('title')}</DialogPrimitive.Title>

          <div className="flex items-center gap-3 border-b border-border px-4">
            <Sparkles className="size-4 shrink-0 text-accent" strokeWidth={1.8} />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setAsked(null);
              }}
              onKeyDown={onKeyDown}
              placeholder={t('placeholder')}
              className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-subtle"
            />
            <Kbd>Esc</Kbd>
          </div>

          <div className="max-h-[52vh] overflow-y-auto p-2">
            {asked ? (
              aiMode ? (
                <div className="m-1"><AskPanel question={asked} mode={aiMode} locale={locale} currency={currency} /></div>
              ) : (
                <div className="ai-glow animate-fade-up m-1 rounded-lg p-5">
                  <p className="font-display text-3xl leading-tight">“{asked}”</p>
                  <p className="mt-3 text-sm text-muted">{t('aiSoon')}</p>
                </div>
              )
            ) : (
              <>
                {!query && (
                  <div className="px-2 pt-2 pb-3">
                    <p className="pb-2 text-[11px] font-medium tracking-[0.14em] text-subtle uppercase">
                      {t('suggestions')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setQuery(s)}
                          className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {askRow && (
                  <CommandRow
                    active={active === 0}
                    onHover={() => setActive(0)}
                    onSelect={() => select(askRow)}
                    icon={<Sparkles className="size-4 text-accent" />}
                    label={
                      <>
                        <span className="text-muted">{t('ask')}:</span> “{askRow.label}”
                      </>
                    }
                  />
                )}

                {navRows.length > 0 && (
                  <p className="px-2.5 pt-3 pb-1.5 text-[11px] font-medium tracking-[0.14em] text-subtle uppercase">
                    {t('navigate')}
                  </p>
                )}
                {navRows.map((row) => {
                  if (row.kind !== 'nav') return null;
                  const index = rows.indexOf(row);
                  return (
                    <CommandRow
                      key={row.id}
                      active={active === index}
                      onHover={() => setActive(index)}
                      onSelect={() => select(row)}
                      icon={<row.Icon className="size-4 text-muted" strokeWidth={1.6} />}
                      label={row.label}
                      trailing={<ArrowRight className="size-3.5 text-subtle" />}
                    />
                  );
                })}

                {query && navRows.length === 0 && (
                  <p className="px-3 py-4 text-sm text-subtle">{t('empty')}</p>
                )}
              </>
            )}
          </div>

          <footer className="flex items-center gap-4 border-t border-border bg-surface-2/60 px-4 py-2.5 text-[11px] text-subtle">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              {t('hintNavigate')}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>
                <CornerDownLeft className="size-3" />
              </Kbd>
              {t('hintSelect')}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <Search className="size-3" />
              {t('title')}
            </span>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function CommandRow({
  active,
  onHover,
  onSelect,
  icon,
  label,
  trailing,
}: {
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
  icon: React.ReactNode;
  label: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-active={active || undefined}
      onMouseMove={onHover}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left text-sm transition-colors duration-100',
        active ? 'bg-surface-2 text-foreground' : 'text-foreground/90',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active && trailing}
    </button>
  );
}
