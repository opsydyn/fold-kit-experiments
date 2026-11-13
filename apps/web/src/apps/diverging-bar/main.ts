import { specApp } from '../spec-app';
import { spec } from './spec';

export const { Model, Message, init, update, view } = specApp(spec);
