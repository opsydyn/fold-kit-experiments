import { Html } from '@effect/ui/html';
import { Data, Schema } from 'effect';

import { teamIcon, type TeamIcon } from '../appearance/icons';

export const Entry = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  mediaType: Schema.Literals(['image/png', 'image/webp']),
  archived: Schema.Number,
});
export const Entries = Schema.Array(Entry);
export type Entries = typeof Entries.Type;
export const Tab = Schema.Literals(['built-in', 'team']);
export const Panel = Schema.Struct({
  open: Schema.Boolean,
  tab: Tab,
  entries: Entries,
  run: Schema.Number,
  busy: Schema.Boolean,
  notice: Schema.String,
});
export type Panel = typeof Panel.Type;
export const initial: Panel = {
  open: false,
  tab: 'built-in',
  entries: [],
  run: 0,
  busy: false,
  notice: '',
};
export const path = (team: string) => `/api/zloz/teams/${encodeURIComponent(team)}/icons`;
export const assetPath = (team: string, reference: string) =>
  `${path(team)}/${encodeURIComponent(reference.slice(5))}`;
export const builtIns = [
  ['user', 'Person'],
  ['package', 'System'],
  ['cloud', 'External system'],
  ['stack', 'Container'],
  ['cube', 'Component'],
] as const satisfies ReadonlyArray<readonly [TeamIcon, string]>;
export const builtInIcon = (reference: string | undefined) =>
  builtIns.find(([key]) => reference === `builtin:${key}`)?.[0];

export function nodeIcon<M>(
  h: Html.H<M>,
  team: string,
  reference: string | undefined,
  fallback: TeamIcon,
  onFailure?: (icon: string) => M,
) {
  if (!reference?.startsWith('team:') || !team)
    return teamIcon(h, builtInIcon(reference) ?? fallback);
  const image = h.img
    .class('team-icon', 'team-uploaded-icon')
    .attrs({ src: assetPath(team, reference), alt: '', width: '20', height: '20' });
  return onFailure ? image.on('error', onFailure(reference)) : image;
}

class IconLibraryError extends Data.TaggedError('IconLibraryError')<{ message: string }> {}

export async function list(team: string) {
  const response = await fetch(path(team));
  if (!response.ok)
    throw new IconLibraryError({ message: 'Could not load the team icon library.' });
  return Schema.decodeUnknownSync(Entries)(await response.json());
}

export async function upload(team: string, file: File) {
  if (file.size > 64 * 1024)
    throw new IconLibraryError({ message: 'Choose an icon no larger than 64 KiB.' });
  const name = file.name
    .replace(/\.[^.]+$/, '')
    .trim()
    .slice(0, 60);
  const response = await fetch(`${path(team)}?${new URLSearchParams({ name })}`, {
    method: 'POST',
    headers: { 'content-type': file.type },
    body: file,
  });
  if (response.status === 409)
    throw new IconLibraryError({ message: 'The library is full or this icon was archived.' });
  if (!response.ok)
    throw new IconLibraryError({
      message: 'Upload failed. Choose a PNG or WebP icon up to 512 × 512.',
    });
  return Schema.decodeUnknownSync(Entry)(await response.json());
}

export async function archive(team: string, id: string) {
  const response = await fetch(`${path(team)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok) throw new IconLibraryError({ message: 'Could not archive this icon.' });
}

export function view<M>(
  h: Html.H<M>,
  panel: Panel,
  team: string,
  selected: string | undefined,
  owner: boolean,
  actions: {
    tab: (tab: typeof Tab.Type) => M;
    choose: (icon: string | null) => M;
    upload: (file: File | undefined) => M;
    archive: (id: string) => M;
  },
) {
  return h.section.attr('aria-label', 'Node icon picker').children(
    h.div
      .attr('role', 'group')
      .attr('aria-label', 'Icon sources')
      .children(
        h.button
          .attr('type', 'button')
          .attr('aria-pressed', String(String(panel.tab === 'built-in')))
          .on('click', actions.tab('built-in'))
          .children('Built-in'),
        h.button
          .attr('type', 'button')
          .attr('aria-pressed', String(String(panel.tab === 'team')))
          .on('click', actions.tab('team'))
          .children('Team library'),
      ),
    h.button
      .attr('type', 'button')
      .disabled(panel.busy || selected === undefined)
      .on('click', actions.choose(null))
      .children('Use default icon'),
    h.p.attr('role', 'status').children(panel.busy ? 'Updating the icon library…' : panel.notice),
    ...(panel.tab === 'built-in'
      ? builtIns.map(([key, name]) =>
          h.button
            .key(key)
            .attr('type', 'button')
            .disabled(panel.busy)
            .attr('aria-pressed', String(String(selected === `builtin:${key}`)))
            .on('click', actions.choose(`builtin:${key}`))
            .children(teamIcon(h, key), name),
        )
      : [
          h.p.children(
            'Uploading adds the icon to the team library and applies it to the selected node for everyone.',
          ),
          h.label.children(
            'Upload and apply icon (PNG or WebP, 64 KiB max)',
            h.input
              .key(String(panel.run))
              .attr('type', 'file')
              .attr('accept', 'image/png,image/webp')
              .disabled(panel.busy)
              .value('')
              .on('change', ({ files }) => actions.upload(files[0])),
          ),
          ...panel.entries.map((icon) =>
            h.div.key(icon.id).children(
              h.button
                .attr('type', 'button')
                .disabled(panel.busy)
                .attr('aria-pressed', String(String(selected === `team:${icon.id}`)))
                .on('click', actions.choose(`team:${icon.id}`))
                .children(nodeIcon(h, team, `team:${icon.id}`, 'cube'), icon.name),
              ...(owner
                ? [
                    h.button
                      .attr('type', 'button')
                      .disabled(panel.busy)
                      .on('click', actions.archive(icon.id))
                      .children(`Archive ${icon.name}`),
                  ]
                : []),
            ),
          ),
        ]),
  );
}
