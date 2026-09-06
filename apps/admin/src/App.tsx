import { Button } from '@/components/ui/button';
import { strings } from './strings';

export function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="font-semibold text-2xl">{strings.heading}</h1>
      <Button variant="outline">{strings.appName}</Button>
    </main>
  );
}
