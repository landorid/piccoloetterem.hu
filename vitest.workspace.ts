/**
 * The Vitest project list. Vitest no longer loads `vitest.workspace.ts` on its
 * own (workspace files were removed in Vitest 4); `vitest.config.ts` reads this
 * list and passes it to `test.projects`.
 */
export default ['packages/*', 'apps/*'];
