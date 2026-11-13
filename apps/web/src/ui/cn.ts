/**
 * T209 — junta classes, ignorando vazias. Sem `clsx`/`tailwind-merge`: a
 * camada só compõe classes próprias e as de quem usa (que vêm por último).
 */
export function cn(
  ...classes: ReadonlyArray<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
