import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-4 h-14 w-80" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-9 w-32" />
          </Card>
        ))}
      </div>
    </div>
  );
}
