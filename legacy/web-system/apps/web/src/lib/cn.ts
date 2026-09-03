/**
 * Minimal class-name combiner — same API surface as `clsx` but
 * dependency-free. Filters out falsy values, joins with spaces.
 */
export type ClassValue = string | number | null | undefined | false | ClassValue[];

export function cn(...args: ClassValue[]): string {
  const out: string[] = [];
  for (const a of args) {
    if (!a) continue;
    if (Array.isArray(a)) {
      const inner = cn(...a);
      if (inner) out.push(inner);
    } else {
      out.push(String(a));
    }
  }
  return out.join(' ');
}
