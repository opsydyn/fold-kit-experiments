import { parseArgs } from 'node:util';

import { BootstrapCommand, BootstrapResult, Problem } from '@opsydyn/zloz-server/src/team-contract';
import { Option, Schema } from 'effect';

import { STAGING_ORIGIN } from './staging-config';

/** Explicit local or staging operator command. Credentials come from the environment, never argv. */
export async function bootstrapMain(args: string[]) {
  try {
    const { values } = parseArgs({
      args,
      strict: true,
      options: {
        'backend-url': { type: 'string', default: 'http://127.0.0.1:1337' },
        'owner-email': { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        apply: { type: 'boolean', default: false },
        staging: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
    });
    if (values.help) {
      console.log(
        'bootstrap --owner-email <verified Google email> --name <team name> --slug <team slug> [--backend-url http://127.0.0.1:1337] [--staging] [--apply]',
      );
      return 0;
    }
    if (values.staging && values['backend-url'] !== 'http://127.0.0.1:1337') {
      console.error('Staging uses its fixed approved origin; do not supply --backend-url.');
      return 2;
    }
    const target = new URL(values.staging ? STAGING_ORIGIN : values['backend-url']);
    if (
      (!values.staging &&
        (target.protocol !== 'http:' ||
          !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))) ||
      target.username ||
      target.password ||
      target.pathname !== '/' ||
      target.search ||
      target.hash
    ) {
      console.error('Bootstrap only targets a local backend origin.');
      return 2;
    }
    const token = process.env.ZLOZ_OPERATOR_TOKEN ?? '';
    if (!/^[a-f0-9]{64}$/.test(token)) {
      console.error(
        'Set ZLOZ_OPERATOR_TOKEN to the same 64-hex-character value as the local backend.',
      );
      return 2;
    }
    const command = Schema.decodeUnknownOption(BootstrapCommand)({
      name: values.name?.trim(),
      slug: values.slug,
      ownerEmail: values['owner-email']?.trim(),
      apply: values.apply,
    });
    if (Option.isNone(command)) {
      console.error(
        'Supply a valid owner email, team name and lowercase slug. Use --help for usage.',
      );
      return 2;
    }
    const response = await fetch(
      new URL(values.staging ? '/api/zloz/operator/bootstrap' : '/internal/bootstrap', target),
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          origin: values.staging ? STAGING_ORIGIN : target.origin,
        },
        body: JSON.stringify(command.value),
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      },
    );
    const text = await response.text();
    if (!response.ok) {
      const error = Schema.decodeUnknownOption(Schema.fromJsonString(Problem))(text);
      console.error(
        Option.isSome(error) ? error.value.message : `Bootstrap failed (${response.status}).`,
      );
      return 1;
    }
    const result = Schema.decodeUnknownOption(Schema.fromJsonString(BootstrapResult))(text);
    if (Option.isNone(result)) {
      console.error('The backend returned an unexpected bootstrap result.');
      return 1;
    }
    console.log(JSON.stringify(result.value));
    return 0;
  } catch {
    console.error('Bootstrap could not complete. Check the local backend and command options.');
    return 1;
  }
}

if (import.meta.main) process.exit(await bootstrapMain(process.argv.slice(2)));
