import { Schema } from 'effect';
import * as Bump from '../../ui/bump-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & { readonly chart: Bump.Model };

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = Bump.init({
    xLabels: ['2019', '2020', '2021', '2022', '2023', '2024'],
    series: [
      { label: 'React', color: '#61dafb', ranks: [1, 1, 1, 1, 1, 1] },
      { label: 'Vue', color: '#42b883', ranks: [3, 2, 2, 3, 3, 3] },
      { label: 'Angular', color: '#dd0031', ranks: [2, 3, 3, 2, 2, 2] },
      { label: 'Svelte', color: '#ff3e00', ranks: [6, 5, 4, 4, 4, 4] },
      { label: 'Solid', color: '#2c4f7c', ranks: [8, 8, 7, 5, 5, 5] },
      { label: 'Qwik', color: '#ac7ef4', ranks: [9, 9, 9, 8, 6, 6] },
      { label: 'Astro', color: '#ff5d01', ranks: [7, 7, 6, 6, 7, 7] },
      { label: 'Lit', color: '#324fff', ranks: [4, 4, 5, 7, 8, 8] },
    ],
  });
  return [{ chart }, []];
};
