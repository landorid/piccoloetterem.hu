import { unwrap } from '@piccolo/api-client';
import { queryOptions } from '@tanstack/react-query';
import { api } from './api';

/** `{ name }` of the restaurant this deployment serves, for the top bar. Fixed per deployment. */
export const configQuery = queryOptions({
  queryKey: ['admin', 'config'],
  queryFn: async () => unwrap(await api.api.admin.config.$get()),
  staleTime: Number.POSITIVE_INFINITY,
});

/** `{ ok, version }` of the API, for the sidebar footer. */
export const healthQuery = queryOptions({
  queryKey: ['health'],
  queryFn: async () => unwrap(await api.api.health.$get()),
  staleTime: Number.POSITIVE_INFINITY,
});

/** Every permanent item, active and inactive, by section (`GET /api/admin/menu/items`). */
export const permanentItemsQuery = queryOptions({
  queryKey: ['admin', 'menu', 'items'],
  queryFn: async () => unwrap(await api.api.admin.menu.items.$get()),
});
