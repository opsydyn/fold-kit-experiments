/*
 * The sitemap: every page, for search engines.
 */
import type { APIRoute } from 'astro';

import { sitemapXml, sitePaths } from '../radar/meta';
import { editions, radar } from '../radar/radar';

export const prerender = true;

export const GET: APIRoute = ({ site, url }) =>
  new Response(sitemapXml(sitePaths(radar, editions), site ?? url), {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
