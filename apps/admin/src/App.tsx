import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '@/components/AppLayout';
import { RequireStaff } from '@/components/StaffGuard';
import { ItemsPage } from '@/pages/ItemsPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { SummaryPage } from '@/pages/SummaryPage';
import { WeeklyMenuPage } from '@/pages/WeeklyMenuPage';
import { paths } from '@/paths';

/** Every admin route. Everything but `/login` is for signed-in staff only. */
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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
