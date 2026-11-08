/** Read-only qualification driver. It emits JSON and never writes a diagram file. */
import { parseGraph } from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';
const Request = Schema.Union([
  Schema.Struct({
    operation: Schema.Literal('import'),
    source: Schema.String,
    lossPolicy: Schema.optionalKey(Schema.Literals(['reject', 'report'])),
    identity: Schema.optionalKey(Schema.Unknown),
  }),
  Schema.Struct({
    operation: Schema.Literal('export'),
    document: Schema.String,
    lossPolicy: Schema.optionalKey(Schema.Literals(['reject', 'report'])),
    direction: Schema.optionalKey(Schema.Literals(['LR', 'RL', 'TB', 'TD', 'BT'])),
  }),
]);
const isRequest = Schema.is(Request);

import { importFlowchart, exportFlowchart, protocol } from './dist/spike.js';

const failure = (message) => ({
  protocol,
  status: 'rejected',
  diagnostics: [
    {
      code: 'invalid-request',
      severity: 'error',
      dimension: 'syntax',
      message,
      subject: null,
      location: null,
    },
  ],
});
const read = async () => {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 1048576) return failure('Request exceeds 1048576 UTF-16 code units.');
  }
  return Promise.resolve()
    .then(() => JSON.parse(input))
    .then(
      async (request) => {
        if (!isRequest(request)) return failure('Invalid operation envelope or loss policy.');
        const lossPolicy = request.lossPolicy ?? 'reject';
        if (request.operation === 'import') {
          const options = { lossPolicy };
          if ('identity' in request) options.identity = request.identity;
          return importFlowchart(request.source, options);
        }
        if (request.operation === 'export')
          return exportFlowchart(parseGraph(request.document), {
            lossPolicy,
            direction: request.direction ?? 'LR',
          });
        return failure('Expected import/source or export/versioned-document.');
      },
      () => failure('Invalid JSON request.'),
    );
};
await read()
  .then(
    (result) => result,
    (error) => failure(error instanceof Error ? error.message : 'Request failed.'),
  )
  .then((result) => {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.status === 'converted' ? 0 : 1;
  });
