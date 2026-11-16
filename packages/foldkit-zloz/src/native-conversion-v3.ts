import type { ZlozGroupEditorStateV3, ZlozGroupEditorResultV3 } from './group-editor-v3';
/** Shared result envelope only; each conversion rebuilds its own semantic plan and native target. */
export type ZlozNativeConversionApplyResultV3<R> =
  | Readonly<{ type: 'applied'; editor: ZlozGroupEditorStateV3; conversion: R }>
  | Readonly<{ type: 'unchanged'; editor: ZlozGroupEditorStateV3 }>
  | Readonly<{
      type: 'blocked';
      editor: ZlozGroupEditorStateV3;
      code:
        | Extract<ZlozGroupEditorResultV3, { type: 'blocked' }>['code']
        | 'unresolved-mapping'
        | 'consent-required'
        | 'policy'
        | 'invalid-conversion';
      reason: string;
    }>;
