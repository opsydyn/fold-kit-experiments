import { describe, expect, it } from 'vitest';

import { serveDataset } from '../../pages/api/datasets';

describe('dataset HTTP boundary', () => {
  it('returns a requested snapshot with dataset identity and raw observations', async () => {
    const response = await serveDataset(
      new URL('http://localhost/api/datasets?dataset=coast&revision=7&profile=fast&fail=false'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      dataset: 'coast',
      revision: 7,
      points: expect.arrayContaining([
        { hour: 0, value: 8 },
        { hour: 2, value: 12 },
      ]),
    });
  });

  it('rejects unknown datasets and invalid request identities', async () => {
    for (const query of ['dataset=unknown&revision=1', 'dataset=north&revision=-1']) {
      expect((await serveDataset(new URL('http://localhost/api/datasets?' + query))).status).toBe(
        400,
      );
    }
  });

  it('returns an HTTP failure when the example requests one', async () => {
    const response = await serveDataset(
      new URL('http://localhost/api/datasets?dataset=north&revision=1&profile=fast&fail=true'),
    );
    expect(response.status).toBe(503);
  });
});
