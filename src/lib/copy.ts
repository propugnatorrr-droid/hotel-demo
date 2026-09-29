/** Albanian-first copy picker. `en` must mirror the shape of `sq`. */
export function makeCopy<T>(sq: T, en: T) {
  return (locale: string): T => (locale === 'en' ? en : sq);
}
