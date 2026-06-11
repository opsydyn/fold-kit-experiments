import { Runtime } from 'foldkit';

import { init, Model, update, view } from './main';

const program = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  container: document.getElementById('foldkit-counter'),
  devTools: {
    position: 'BottomLeft',
  },
});

Runtime.run(program);
