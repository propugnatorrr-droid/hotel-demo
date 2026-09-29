import { PageTransition } from '@/components/app/page-transition';

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
