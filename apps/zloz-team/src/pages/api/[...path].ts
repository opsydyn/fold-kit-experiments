import type { APIRoute } from 'astro';

import { forward } from '../../server/backend';

// Return the original response: re-encoding would lose upgrades or Set-Cookie values.
export const ALL: APIRoute = ({ request }) => forward(request);
