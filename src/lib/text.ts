// Lowercases and strips diacritics so accent-insensitive search works:
// e.g. "Raúl Rangel" and "Raul Rangel" both match a query of "raul".
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
