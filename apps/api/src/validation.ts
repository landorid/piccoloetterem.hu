import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
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
