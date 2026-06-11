// SI prefix symbols — index 8 is '' (no prefix, 10^0)
// k = index 9 (10^3), M = index 10 (10^6), G = index 11 (10^9), etc.
const SI = [
  'y',
  'z',
  'a',
  'f',
  'p',
  'n',
  'µ',
  'm',
  '',
  'k',
  'M',
  'G',
  'T',
  'P',
  'E',
  'Z',
  'Y',
] as const;

function siGroupIndex(exp: number): number {
  return Math.max(0, Math.min(16, Math.floor(exp / 3) + 8));
}

// Remove trailing zeros after decimal point: "1.200" → "1.2", "1.000" → "1"
function trimZeros(s: string): string {
  const dot = s.indexOf('.');
  if (dot < 0) return s;
  let end = s.length - 1;
  while (end > dot && s[end] === '0') end--;
  if (s[end] === '.') end--;
  return s.slice(0, end + 1);
}

function addCommas(s: string): string {
  const dotIdx = s.indexOf('.');
  const int = dotIdx < 0 ? s : s.slice(0, dotIdx);
  const dec = dotIdx < 0 ? '' : s.slice(dotIdx);
  const neg = int.startsWith('-');
  const digits = neg ? int.slice(1) : int;
  return (neg ? '-' : '') + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + dec;
}

type FormatType = 'f' | '%' | 's' | 'e' | 'd' | 'g' | '';

interface Spec {
  comma: boolean;
  precision: number | undefined;
  trim: boolean;
  type: FormatType;
}

// Specifier grammar (subset of D3): [,]?[.precision]?[~]?[type]
function parseSpec(spec: string): Spec {
  const m = /^(,)?(?:\.(\d+))?(~)?([fesgd%]?)$/.exec(spec.trim());
  if (!m) return { comma: false, precision: undefined, trim: false, type: '' };
  return {
    comma: m[1] === ',',
    precision: m[2] != null ? parseInt(m[2], 10) : undefined,
    trim: m[3] === '~',
    type: (m[4] ?? '') as FormatType,
  };
}

/**
 * Returns a formatter function for the given D3-style specifier string.
 *
 * Supported: [,][.precision][~][type]
 *   f  — fixed decimal (default precision 6)
 *   %  — percentage ×100 (default precision 6)
 *   s  — SI prefix (k M G T …); precision = significant figures (default 3)
 *   e  — exponential notation
 *   d  — integer (rounds to nearest)
 *   g  — significant digits via toPrecision
 *   ,  — thousands separator
 *   ~  — trim trailing zeros
 */
export function format(specifier: string): (value: number) => string {
  const { comma, precision, trim, type } = parseSpec(specifier);

  return (value: number): string => {
    if (!Number.isFinite(value)) return String(value);

    switch (type) {
      case 'f': {
        let r = value.toFixed(precision ?? 6);
        if (trim) r = trimZeros(r);
        if (comma) r = addCommas(r);
        return r;
      }
      case '%': {
        const raw = (value * 100).toFixed(precision ?? 6);
        const num = trim ? trimZeros(raw) : raw;
        return `${comma ? addCommas(num) : num}%`;
      }
      case 's': {
        if (value === 0) return '0';
        const exp = Math.floor(Math.log10(Math.abs(value)));
        const gi = siGroupIndex(exp);
        const siSuffix = SI[gi] ?? '';
        const scale = 10 ** ((gi - 8) * 3);
        const scaled = value / scale;
        const p = precision ?? 3;
        const scaledAbs = Math.abs(scaled);
        const dec = scaledAbs > 0 ? Math.max(0, p - Math.floor(Math.log10(scaledAbs)) - 1) : 0;
        let num = scaled.toFixed(dec);
        if (trim) num = trimZeros(num);
        return num + siSuffix;
      }
      case 'e': {
        let r = value.toExponential(precision ?? 6);
        if (trim) r = trimZeros(r);
        return r;
      }
      case 'd': {
        const r = Math.round(value).toString();
        return comma ? addCommas(r) : r;
      }
      case 'g': {
        let r = parseFloat(value.toPrecision(precision ?? 6)).toString();
        if (comma) r = addCommas(r);
        return r;
      }
      default: {
        return String(value);
      }
    }
  };
}

/** Format with SI prefix and trimmed trailing zeros (convenience wrapper). */
export function siFormat(value: number, precision = 2): string {
  return format(`.${precision}~s`)(value);
}
