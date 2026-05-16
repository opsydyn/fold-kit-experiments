import { persistentAtom } from '@nanostores/persistent';

export const usernameAtom = persistentAtom<string>('fk:username', '');
