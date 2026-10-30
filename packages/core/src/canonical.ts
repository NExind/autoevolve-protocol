export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(",")}}`;
}

export async function sha256Hex(value: unknown): Promise<`0x${string}`> {
  const bytes = new TextEncoder().encode(
    typeof value === "string" ? value : canonicalJson(value),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

export function hashToUint128Limbs(hash: `0x${string}`): {
  low: bigint;
  high: bigint;
} {
  const value = BigInt(hash);
  const mask = (1n << 128n) - 1n;
  return { low: value & mask, high: value >> 128n };
}
