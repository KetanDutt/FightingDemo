/**
 * Web font loading.
 *
 * The display + body faces ship as woff2 via `@fontsource/*` (bundled by
 * Vite from `src/style.css`). Phaser draws canvas text with whatever is in
 * `document.fonts`, so the boot scene awaits these before the first scene
 * renders — otherwise menu text would flash in a fallback face.
 */
const DISPLAY_WEIGHTS = [600, 700, 800, 900];
const BODY_WEIGHTS = [400, 500, 600, 700];

/** Resolves once the game fonts are usable (or immediately if unsupported). */
export async function loadFonts() {
  const fonts = document?.fonts;
  if (!fonts?.load) return;
  const requests = [
    ...DISPLAY_WEIGHTS.map((weight) => fonts.load(`${weight} 32px "Saira Condensed"`, 'MAYHEM 01')),
    ...BODY_WEIGHTS.map((weight) => fonts.load(`${weight} 16px "Inter"`, 'Mayhem 0123')),
  ];
  try {
    await Promise.all(requests);
    await fonts.ready;
  } catch {
    // Fall back to the system stacks declared in FONTS.
  }
}
