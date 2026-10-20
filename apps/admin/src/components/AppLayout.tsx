import { useState } from 'react';
import { Outlet } from 'react-router';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useMediaQuery } from '@/hooks/use-media-query';
import { strings } from '@/strings';

/** Below this width the sidebar starts collapsed to its icons. */
const WIDE = '(min-width: 1024px)';

/**
 * Every signed-in staff screen: the sidebar (with the restaurant name and Clerk's `UserButton`) and
 * the page. Under 768px shadcn swaps the sidebar for a sheet, and a slim bar holds its trigger; from
 * there up the sidebar is toggled from its edge (the rail) or with Ctrl/Cmd+B.
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
      {/* min-w-0: a wide table scrolls inside the page instead of widening it. */}
      <SidebarInset className="min-w-0">
        <header className="flex h-12 shrink-0 items-center border-b px-4 md:hidden">
          <SidebarTrigger
            className="-ml-1"
            aria-label={strings.sidebar.toggle}
            title={strings.sidebar.toggle}
          />
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
