/**
 * The only entry point other workspaces may import from this Worker: `@piccolo/api/types`, a
 * types-only export (`packages/api-client`). Never import the Worker's runtime from elsewhere.
 */
export type { AppType } from './app';
