 /**
 * Fixed club catalog (phase 16, D54). The user's own set: wedges are named by loft.
 * The catalog order is the display order. Codes are stable: they are stored, backed up and exported.
 */
export const CLUB_CATALOG = [
  { code: 'driver', label: 'Driver' },
  { code: 'wood3', label: 'Madera 3' },
  { code: 'hybrid', label: 'Híbrido' },
  { code: 'iron4', label: 'Hierro 4' },
  { code: 'iron5', label: 'Hierro 5' },
  { code: 'iron6', label: 'Hierro 6' },
  { code: 'iron7', label: 'Hierro 7' },
  { code: 'iron8', label: 'Hierro 8' },
  { code: 'iron9', label: 'Hierro 9' },
  { code: 'pw', label: 'PW' },
  { code: 'wedge52', label: '52º' },
  { code: 'wedge56', label: '56º' },
  { code: 'wedge64', label: '64º' },
  { code: 'putter', label: 'Putter' },
] as const;

export type ClubCode = (typeof CLUB_CATALOG)[number]['code'];

export const PUTTER: ClubCode = 'putter';

const CODES: readonly string[] = CLUB_CATALOG.map((club) => club.code);

export function isClubCode(value: unknown): value is ClubCode {
  return typeof value === 'string' && CODES.includes(value);
}

export function isPutter(club: ClubCode): boolean {
  return club === PUTTER;
}

export function clubLabel(code: ClubCode): string {
  return CLUB_CATALOG.find((club) => club.code === code)?.label ?? code;
}

/** Bag used until the user configures one: every club of the catalog. */
export const DEFAULT_CLUB_BAG: readonly ClubCode[] = CLUB_CATALOG.map((club) => club.code);

/**
 * Validates a club bag: a non-empty array of known codes without repeats.
 * Returns it in catalog order and always including the putter, because the putter is the
 * marker that ends a hole's shots (D37). Returns null when the value is not a valid bag.
 */
export function parseClubBag(value: unknown): ClubCode[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: unknown[] = value;
  const seen = new Set<string>();
  for (const item of items) {
    if (!isClubCode(item) || seen.has(item)) return null;
    seen.add(item);
  }
  seen.add(PUTTER);
  return CLUB_CATALOG.map((club) => club.code).filter((code) => seen.has(code));
}