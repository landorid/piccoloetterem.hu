import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '../lib/api';
import { strings } from '../strings';
import { describeLoadError } from './OrderingApp';

describe('describeLoadError', () => {
  it('maps week_not_published to the empty-week copy', () => {
    expect(describeLoadError(new ApiError(404, 'week_not_published', ''))).toEqual({
      title: strings.errors.emptyWeekTitle,
      body: strings.errors.emptyWeekBody,
    });
  });

  it('maps anything else to the load failure', () => {
    for (const error of [new ApiError(500, 'internal', ''), new NetworkError(), new Error('x')]) {
      expect(describeLoadError(error)).toEqual({
        title: strings.errors.loadFailedTitle,
        body: strings.errors.loadFailedBody,
      });
    }
  });
});
