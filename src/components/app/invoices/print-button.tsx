'use client';

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="h-10 rounded-full bg-ionian-900 px-5 text-sm text-limestone-50">
      {label}
    </button>
  );
}
