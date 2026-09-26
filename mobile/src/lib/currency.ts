// Country → currency, and price formatting for the country picker.
//
// products.price is always USD (see supabase migration 024). products.prices
// holds the real prices a store publishes per currency, e.g.
// {"USD": 409, "GBP": 370} — so a UK shopper sees Story mfg.'s actual £370,
// not a USD→GBP round-trip. Anything without a real price in the shopper's
// currency is converted from USD at the day's ECB rate (fx_rates table).

export interface Country {
  code: string;      // ISO 3166 alpha-2
  name: string;
  currency: string;  // ISO 4217
}

export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States',  currency: 'USD' },
  { code: 'CA', name: 'Canada',         currency: 'CAD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'IE', name: 'Ireland',        currency: 'EUR' },
  { code: 'FR', name: 'France',         currency: 'EUR' },
  { code: 'DE', name: 'Germany',        currency: 'EUR' },
  { code: 'IT', name: 'Italy',          currency: 'EUR' },
  { code: 'ES', name: 'Spain',          currency: 'EUR' },
  { code: 'PT', name: 'Portugal',       currency: 'EUR' },
  { code: 'NL', name: 'Netherlands',    currency: 'EUR' },
  { code: 'BE', name: 'Belgium',        currency: 'EUR' },
  { code: 'AT', name: 'Austria',        currency: 'EUR' },
  { code: 'FI', name: 'Finland',        currency: 'EUR' },
  { code: 'DK', name: 'Denmark',        currency: 'DKK' },
  { code: 'SE', name: 'Sweden',         currency: 'SEK' },
  { code: 'NO', name: 'Norway',         currency: 'NOK' },
  { code: 'CH', name: 'Switzerland',    currency: 'CHF' },
  { code: 'AU', name: 'Australia',      currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand',    currency: 'NZD' },
  { code: 'JP', name: 'Japan',          currency: 'JPY' },
  { code: 'KR', name: 'South Korea',    currency: 'KRW' },
  { code: 'SG', name: 'Singapore',      currency: 'SGD' },
  { code: 'HK', name: 'Hong Kong',      currency: 'HKD' },
  { code: 'MX', name: 'Mexico',         currency: 'MXN' },
];

export const DEFAULT_COUNTRY = 'US';

export function countryByCode(code: string | null | undefined): Country {
  return COUNTRIES.find(c => c.code === code) ?? COUNTRIES[0];
}

// The device's region (e.g. "en-GB" → GB), used until someone picks a
// country themselves. Intl is available on Hermes and every browser.
export function deviceCountry(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const region = locale.split(/[-_]/).find(part => /^[A-Z]{2}$/.test(part));
    return region && COUNTRIES.some(c => c.code === region) ? region : DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}

// A price for display in `currency`, preferring the store's own published
// price in that currency when there is one. Real prices keep their cents
// when they have any ($12.95, £370); converted ones round to whole units,
// since cents on an estimate would be false precision.
export function formatPrice(
  item: { price: number; prices?: Record<string, number> | null },
  currency: string,
  rates: Record<string, number>,
): string {
  const native = item.prices?.[currency];
  if (typeof native === 'number' && native > 0) return formatMoney(native, currency, !Number.isInteger(native));
  const rate = rates[currency];
  // No rate loaded (yet) → show honest USD rather than a mislabeled number.
  if (currency === 'USD' || !rate) return formatMoney(item.price, 'USD', !Number.isInteger(item.price));
  return formatMoney(item.price * rate, currency, false);
}

// Plain amount conversion, for sums (board totals) and price filters.
export function convertFromUsd(usd: number, currency: string, rates: Record<string, number>): number {
  const rate = currency === 'USD' ? 1 : rates[currency];
  return rate ? usd * rate : usd;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: string, cents = false): string {
  const key = `${currency}:${cents ? 1 : 0}`;
  let f = formatters.get(key);
  if (!f) {
    // en-US locale keeps symbol placement consistent app-wide; the currency
    // code, not the locale, decides the symbol (£, €, ¥, A$, CA$...).
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    });
    formatters.set(key, f);
  }
  return f.format(amount);
}
