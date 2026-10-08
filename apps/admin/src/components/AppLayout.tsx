import { UserButton } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Outlet } from 'react-router';
import { AppSidebar } from '@/components/AppSidebar';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { configQuery } from '@/queries';
import { strings } from '@/strings';

/** Below this width the sidebar starts collapsed to its icons. */
const WIDE = '(min-width: 1024px)';

function RestaurantName() {
  const config = useQuery(configQuery);

  if (config.isPending) {
    return <Skeleton className="h-5 w-48" />;
  }
  return <span className="truncate font-semibold">{config.data?.name ?? strings.appName}</span>;
}

/**
 * Every signed-in staff screen: the sidebar, a top bar with the restaurant name and Clerk's
 * `UserButton`, and the page. Under 768px shadcn swaps the sidebar for a sheet.
 */
export function AppLayout() {
  const wide = useMediaQuery(WIDE);
  // Open on wide screens, collapsed below 1024px. A toggle holds until the window crosses the
  // breakpoint again.
  const [toggled, setToggled] = useState<{ wide: boolean; open: boolean } | null>(null);
  const open = toggled?.wide === wide ? toggled.open : wide;

  return (
    <SidebarProvider open={open} onOpenChange={(next) => setToggled({ wide, open: next })}>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger
            className="-ml-1"
            aria-label={strings.sidebar.toggle}
            title={strings.sidebar.toggle}
          />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <RestaurantName />
          <div className="ml-auto flex items-center">
            <UserButton />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
