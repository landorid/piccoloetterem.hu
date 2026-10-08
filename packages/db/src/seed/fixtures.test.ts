import { validateMenuItem } from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import { permanentItems, weeklyItems } from './fixtures';

describe('dev seed fixtures', () => {
  it.each([...permanentItems, ...Object.values(weeklyItems)])(
    '$name passes validateMenuItem',
    (item) => {
      expect(validateMenuItem(item)).toBeNull();
    },
  );
});
