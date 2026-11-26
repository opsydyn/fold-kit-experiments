import { fail, isNumber, numeric } from './channels.js';
import type { PlotAxis, PlotValueFormat, Value } from './types.js';

export const withAxisFormat = (axis: PlotAxis, format: PlotValueFormat | undefined): PlotAxis =>
  format === undefined ? axis : { ...axis, format };

/** Use the same descriptor for chart ticks, data tables and host-owned readouts. */
export function plotValueFormatter(
  format: PlotValueFormat,
  path = 'format',
): (value: Value | undefined) => string {
  if (format.kind !== 'dateTime' && format.digits !== undefined) {
    const { digits } = format;
    if (!(Number.isInteger(digits) && digits >= 0 && digits <= 20))
      return fail(`${path}.digits`, 'must be an integer from zero to twenty');
  }
  const locales = [format.locale ?? 'en-US', 'en-US'];
  // oxlint-disable-next-line linteffect/no-try-catch -- Intl rejects unsupported format settings synchronously.
  try {
    if (format.kind === 'dateTime') {
      const formatter = new Intl.DateTimeFormat(locales, {
        timeZone: format.timeZone ?? 'UTC',
        dateStyle: format.dateStyle ?? (format.timeStyle === undefined ? 'medium' : undefined),
        timeStyle: format.timeStyle,
      });
      return (value) => {
        const at = value === undefined ? Number.NaN : numeric(value);
        return Math.abs(at) <= 8.64e15 ? formatter.format(at) : String(value ?? '');
      };
    }
    const formatter = new Intl.NumberFormat(locales, {
      style: format.kind === 'number' ? 'decimal' : format.kind,
      maximumFractionDigits: format.digits,
      unit: format.kind === 'unit' ? format.unit : undefined,
    });
    return (value) => (isNumber(value) ? formatter.format(value) : String(value ?? ''));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return fail(path, error.message);
  }
}
