import { describe, expect, it } from 'bun:test';

import { requestFrame } from '../src/requests';
import { handle, optionsFrom } from '../src/server';

const frame = requestFrame(20_000);
const get = (path: string) => handle(new Request(`http://localhost${path}`), frame);

describe('GET /', () => {
  it('renders the page with both charts and the costs, and no script', async () => {
    const response = await get('/');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html.match(/<svg/g)?.length).toBe(2);
    expect(html).toContain('Requests by latency');
    expect(html).toContain('Latency against payload');
    expect(html).toContain('What this request cost the server');
    expect(html).toContain('20,000');
    expect(html).not.toContain('<script');
  });

  it('includes a readable data table for each chart and a native GET form', async () => {
    const response = await get('/?bin=100&max=1000');
    let dataTables = 0;
    const values = new Map<string, string | null>();
    const formAttributes = new Map<string, string | null>();
    const inspected = new HTMLRewriter()
      .on('figure.chart table.plot-data', {
        element() {
          dataTables += 1;
        },
      })
      .on('form.controls', {
        element(form) {
          formAttributes.set('method', form.getAttribute('method'));
          formAttributes.set('action', form.getAttribute('action'));
        },
      })
      .on('form.controls input[name]', {
        element(field) {
          const name = field.getAttribute('name');
          if (name !== null) values.set(name, field.getAttribute('value'));
        },
      })
      .transform(response);
    await inspected.text();
    expect(dataTables).toBe(2);
    expect(formAttributes).toEqual(
      new Map([
        ['method', 'get'],
        ['action', '/'],
      ]),
    );
    expect(values).toEqual(
      new Map([
        ['bin', '100'],
        ['max', '1000'],
      ]),
    );
  });

  it('summarises again with the bin width and cap it is given', async () => {
    const html = await (await get('/?bin=100&max=1000')).text();
    expect(html).toContain('in 100 ms bins');
    expect(html).toContain('up to 1000 ms');
  });
});

describe('GET /spec.json', () => {
  it('sends the histogram spec as JSON, naming the schema', async () => {
    const response = await get('/spec.json?bin=100');
    expect(response.status).toBe(200);
    const spec = await response.json();
    expect(spec.$schema).toContain('plot-spec.schema.json');
    const { x1, x2 } = spec.data.columns;
    expect(x2[0] - x1[0]).toBe(100);
  });
});

describe('requests it refuses', () => {
  it('answers 400 for a bin width or cap out of range, and 404 elsewhere', async () => {
    expect((await get('/?bin=0')).status).toBe(400);
    expect(await (await get('/?bin=2.5')).text()).toBe('bin must be a whole number from 5 to 1000');
    expect((await get('/spec.json?max=99999')).status).toBe(400);
    expect((await get('/favicon.ico')).status).toBe(404);
  });

  it('takes the defaults when a parameter is absent or empty', () => {
    expect(optionsFrom(new URL('http://localhost/?bin='))).toEqual({
      ok: true,
      value: { binWidth: 50, maxLatency: 3_000 },
    });
  });
});
