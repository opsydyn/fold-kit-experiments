import { astro, FetchState } from 'astro/fetch';

export default {
  fetch(request: Request) {
    return astro(new FetchState(request));
  },
};
