export type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
  fallback = ""
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

export function numberParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
  fallback: number
) {
  const value = Number(firstParam(params, key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function cleanSearchParams(
  params: Record<string, string | string[] | undefined>,
  keys: string[]
) {
  return keys.reduce<Record<string, string | undefined>>((acc, key) => {
    const value = firstParam(params, key);

    if (value) {
      acc[key] = value;
    }

    return acc;
  }, {});
}
