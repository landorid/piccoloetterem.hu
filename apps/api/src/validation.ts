import { zValidator } from '@hono/zod-validator';
import type { Context, ValidationTargets } from 'hono';
import type { z } from 'zod';

/**
 * `zValidator` with the API's failure shape: 400 `{ error: 'validation', fields }`, where
 * `fields` maps each invalid path (`items.0.quantity`, or `''` for the root) to the zod issue
 * code of its first problem. The frontends turn those codes into Hungarian messages.
 */
export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: 'validation' as const, fields: issueFields(result.error.issues) },
        400,
      );
    }
  });
}

/**
 * The same 400 for a rule `packages/core` rejects after the request parsed: `fields` maps each
 * invalid path to core's error code.
 */
export function validationFailed(c: Context, fields: Readonly<Partial<Record<string, string>>>) {
  const codes: Record<string, string> = {};
  for (const [path, code] of Object.entries(fields)) {
    if (code !== undefined) {
      codes[path] = code;
    }
  }
  return c.json({ error: 'validation' as const, fields: codes }, 400);
}

export function issueFields(
  issues: readonly { path: readonly PropertyKey[]; code: string }[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.');
    fields[key] ??= issue.code;
  }
  return fields;
}
