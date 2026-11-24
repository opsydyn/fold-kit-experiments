import { Data, Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';

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
  h: HtmlBuilder<M>,
  team: string,
  reference: string | undefined,
  fallback: TeamIcon,
  onFailure?: (icon: string) => M,
) {
  return reference?.startsWith('team:') && team
    ? h.img([
        h.Src(assetPath(team, reference)),
        h.Alt(''),
        h.Width('20'),
        h.Height('20'),
        h.Class('team-icon team-uploaded-icon'),
        ...(onFailure ? [h.OnError(onFailure(reference))] : []),
      ])
    : teamIcon(h, builtInIcon(reference) ?? fallback);
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
  h: HtmlBuilder<M>,
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
  return h.section(
    [h.AriaLabel('Node icon picker')],
    [
      h.div(
        [h.Role('group'), h.AriaLabel('Icon sources')],
        [
          h.button(
            [
              h.Type('button'),
              h.AriaPressed(String(panel.tab === 'built-in')),
              h.OnClick(actions.tab('built-in')),
            ],
            ['Built-in'],
          ),
          h.button(
            [
              h.Type('button'),
              h.AriaPressed(String(panel.tab === 'team')),
              h.OnClick(actions.tab('team')),
            ],
            ['Team library'],
          ),
        ],
      ),
      h.button(
        [
          h.Type('button'),
          h.Disabled(panel.busy || selected === undefined),
          h.OnClick(actions.choose(null)),
        ],
        ['Use default icon'],
      ),
      h.p([h.Role('status')], [panel.busy ? 'Updating the icon library…' : panel.notice]),
      ...(panel.tab === 'built-in'
        ? builtIns.map(([key, name]) =>
            h.button(
              [
                h.Key(key),
                h.Type('button'),
                h.Disabled(panel.busy),
                h.AriaPressed(String(selected === `builtin:${key}`)),
                h.OnClick(actions.choose(`builtin:${key}`)),
              ],
              [teamIcon(h, key), name],
            ),
          )
        : [
            h.p(
              [],
              [
                'Uploading adds the icon to the team library and applies it to the selected node for everyone.',
              ],
            ),
            h.label(
              [],
              [
                'Upload and apply icon (PNG or WebP, 64 KiB max)',
                h.input([
                  h.Key(String(panel.run)),
                  h.Type('file'),
                  h.Accept('image/png,image/webp'),
                  h.Disabled(panel.busy),
                  h.OnFileChange(([file]) => actions.upload(file)),
                ]),
              ],
            ),
            ...panel.entries.map((icon) =>
              h.div(
                [h.Key(icon.id)],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.Disabled(panel.busy),
                      h.AriaPressed(String(selected === `team:${icon.id}`)),
                      h.OnClick(actions.choose(`team:${icon.id}`)),
                    ],
                    [nodeIcon(h, team, `team:${icon.id}`, 'cube'), icon.name],
                  ),
                  ...(owner
                    ? [
                        h.button(
                          [
                            h.Type('button'),
                            h.Disabled(panel.busy),
                            h.OnClick(actions.archive(icon.id)),
                          ],
                          [`Archive ${icon.name}`],
                        ),
                      ]
                    : []),
                ],
              ),
            ),
          ]),
    ],
  );
}
