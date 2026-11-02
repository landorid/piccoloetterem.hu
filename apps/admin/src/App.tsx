import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '@/components/AppLayout';
import { RequireOrgAdmin, RequireStaff } from '@/components/StaffGuard';
import { ComingSoon } from '@/pages/ComingSoon';
import { ItemsPage } from '@/pages/ItemsPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { SummaryPage } from '@/pages/SummaryPage';
import { WeeklyMenuPage } from '@/pages/WeeklyMenuPage';
import { paths } from '@/paths';

/**
 * Every admin route. Everything but `/login` is for signed-in staff only; the statistics are for
 * the organization's `org:admin` role only.
 */
export function App() {
  return (
    <Routes>
      {/* Clerk's path routing adds sub-steps such as /login/factor-one. */}
      <Route path={`${paths.login}/*`} element={<LoginPage />} />
      <Route element={<RequireStaff />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to={paths.orders} replace />} />
          <Route path={paths.orders} element={<OrdersPage />} />
          <Route path={paths.summary} element={<SummaryPage />} />
          <Route path={paths.weeklyMenu} element={<WeeklyMenuPage />} />
          <Route path={paths.items} element={<ItemsPage />} />
          <Route element={<RequireOrgAdmin />}>
            <Route path={paths.stats.overview} element={<ComingSoon />} />
            <Route path={paths.stats.dishes} element={<ComingSoon />} />
            <Route path={paths.stats.dish} element={<ComingSoon />} />
            <Route path={paths.stats.customers} element={<ComingSoon />} />
            <Route path={paths.stats.customer} element={<ComingSoon />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
