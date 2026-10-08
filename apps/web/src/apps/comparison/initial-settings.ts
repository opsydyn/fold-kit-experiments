import type { Settings } from './settings';

export const initialSettings: Settings = {
  panels: [
    { id: 1, kind: 'scatter' },
    { id: 2, kind: 'histogram' },
  ],
  linkInspections: true,
  nextPanelId: 3,
};
