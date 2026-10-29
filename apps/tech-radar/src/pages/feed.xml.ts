/*
 * The Atom feed of editions: subscribe, and each new edition arrives with what changed.
 */
import type { APIRoute } from 'astro';

import { feedXml } from '../radar/meta';
import { editions, radar, radarIntro, radarTitle } from '../radar/radar';

export const prerender = true;

export const GET: APIRoute = ({ site, url }) =>
  new Response(feedXml(radar, editions, { title: radarTitle, intro: radarIntro }, site ?? url), {
    headers: { 'content-type': 'application/atom+xml; charset=utf-8' },
  });
