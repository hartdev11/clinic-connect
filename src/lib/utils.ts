/**
 * Merge class names. Used by UI primitives.
 * Does not use clsx/tailwind-merge to avoid extra deps.
 */
export function cn(
  ...classes: (string | undefined | false | null)[]
): string {
  return classes.filter(Boolean).join(" ");
}
