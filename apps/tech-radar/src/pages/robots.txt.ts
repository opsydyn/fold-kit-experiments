/*
 * Every page may be crawled; the sitemap lists them.
 */
import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = ({ site, url }) =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site ?? url).href}\n`,
    {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    },
  );
