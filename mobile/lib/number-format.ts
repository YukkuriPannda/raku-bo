const japaneseNumberFormatter = new Intl.NumberFormat('ja-JP');

export function formatNumberJa(value: number): string {
  return japaneseNumberFormatter.format(value);
}
