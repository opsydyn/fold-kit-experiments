import { inbound } from 'foldkit/port';

import { NavigationValue } from './contract';

export { NavigationValue } from './contract';
export const NavigationPort = inbound(NavigationValue);
export const toNavigationValue = (event: NavigationValue): NavigationValue => event;
