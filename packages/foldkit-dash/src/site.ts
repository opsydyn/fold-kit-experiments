/**
 * A site from a report: every page's document, and the page script when any page has
 * inputs. `build` writes these files; `dev` serves them.
 * @module Site
 */
import { Effect } from 'effect';

import { documentOf, hrefFrom } from './page';
import { DashInvocationError } from './problems';
import type { PagePlan, Report } from './project';
import { bundleClient, type ClientScript, renderApp } from './render';

/** A file of the site: its path under the output folder, and its text. */
export type SiteFile = { readonly path: string; readonly text: string };

/** An interactive page's document: its app rendered, with the page script it hydrates with. */
function appPage(
  report: Report,
  page: Extract<PagePlan, { readonly _tag: 'App' }>,
  script: ClientScript,
) {
  const rendering = renderApp(page.flags, script.buildId);
  return rendering.pipe(
    Effect.map((body) => ({
      path: page.output,
      text: documentOf({
        title: page.title,
        output: page.output,
        nav: report.nav,
        body,
        script: hrefFrom(page.output, script.file),
      }),
    })),
  );
}

/** Every file of the site, in page order, the page script last. */
export const renderSite = (report: Report) => {
  const rendering = Effect.gen(function* () {
    const apps = report.pages.filter((page) => page._tag === 'App');
    const script = apps.length === 0 ? null : yield* bundleClient;
    const pages = yield* Effect.forEach(report.pages, (page) =>
      page._tag === 'Static' || script === null
        ? Effect.succeed({ path: page.output, text: page._tag === 'Static' ? page.html : '' })
        : appPage(report, page, script),
    );
    const files: ReadonlyArray<SiteFile> =
      script === null ? pages : [...pages, { path: script.file, text: script.text }];
    return files;
  });
  // A page that cannot render, or a script that cannot bundle, is the tool's failure, not
  // the project's: the command cannot run (exit 2).
  return rendering.pipe(
    Effect.mapError(
      (error) => new DashInvocationError({ message: `could not build the site: ${String(error)}` }),
    ),
    Effect.withSpan('foldkit-dash.site'),
  );
};
