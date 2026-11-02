import { UserButton } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  ChefHat,
  type LucideIcon,
  ReceiptText,
  Soup,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { Link, NavLink, useMatch } from 'react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsOrgAdmin } from '@/hooks/use-is-org-admin';
import { paths } from '@/paths';
import { configQuery, healthQuery } from '@/queries';
import { strings } from '@/strings';

type NavItemProps = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Active on `to` only, not on the paths under it. */
  end?: boolean;
};

const navItems: readonly NavItemProps[] = [
  { to: paths.orders, label: strings.nav.orders, icon: ReceiptText },
  { to: paths.summary, label: strings.nav.summary, icon: ChefHat },
  { to: paths.weeklyMenu, label: strings.nav.weeklyMenu, icon: CalendarDays },
  { to: paths.items, label: strings.nav.items, icon: BookOpen },
];

/** Shown to `org:admin` only. */
const statsNavItems: readonly NavItemProps[] = [
  { to: paths.stats.overview, label: strings.nav.stats.overview, icon: ChartColumn, end: true },
  { to: paths.stats.dishes, label: strings.nav.stats.dishes, icon: Soup },
  { to: paths.stats.customers, label: strings.nav.stats.customers, icon: Users },
];

function NavItem({ to, label, icon: Icon, end = false }: NavItemProps) {
  const active = useMatch({ path: to, end }) !== null;
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <NavLink to={to} end={end} onClick={() => isMobile && setOpenMobile(false)}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** The restaurant's name from the API, under the app name. */
function RestaurantName() {
  const config = useQuery(configQuery);

  if (config.isPending) {
    return <Skeleton className="h-3 w-24" />;
  }
  return <span className="truncate text-sidebar-foreground/70 text-xs">{config.data?.name}</span>;
}

function ApiVersion() {
  const health = useQuery(healthQuery);

  if (health.isError) {
    return strings.sidebar.apiUnreachable;
  }
  if (!health.data) {
    return null;
  }
  return (
    <>
      {strings.sidebar.apiVersion} <code>{health.data.version}</code>
    </>
  );
}

/** The staff navigation. Collapses to its icons (`collapsible="icon"`), with tooltips. */
export function AppSidebar() {
  const isOrgAdmin = useIsOrgAdmin();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to={paths.home}>
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <UtensilsCrossed className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-semibold">{strings.appName}</span>
                  <RestaurantName />
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <nav aria-label={strings.nav.label}>
            <SidebarMenu>
              {navItems.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </SidebarMenu>
          </nav>
        </SidebarGroup>
        {isOrgAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{strings.nav.stats.label}</SidebarGroupLabel>
            <nav aria-label={strings.nav.stats.label}>
              <SidebarMenu>
                {statsNavItems.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <UserButton />
          <p className="min-w-0 truncate text-muted-foreground text-xs group-data-[collapsible=icon]:hidden">
            <ApiVersion />
          </p>
        </div>
      </SidebarFooter>
      <SidebarRail aria-label={strings.sidebar.toggle} title={strings.sidebar.toggle} />
    </Sidebar>
  );
}
