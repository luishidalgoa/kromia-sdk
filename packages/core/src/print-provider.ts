/**
 * KRO-233 — Perfil de un PROVEEDOR DE IMPRESIÓN curado.
 *
 * Kromia NO imprime: es intermediario. Este perfil es lo que el admin captura de
 * cada imprenta para (a) **recomendar** proveedores compatibles con una tirada y
 * (b) **adaptar** el paquete de export (el ZIP) a los requisitos de ese proveedor.
 *
 * Los campos salen del research de formato de imprenta (KRO-216,
 * `docs/print-format-spec.md`). Es DATA (registro por proveedor) → **no bumpea el
 * KRP**. El espejo Dart no es necesario (Flutter no lo consume; es admin/Studio).
 */

/** Estado de curación del perfil (solo `active` es visible al publisher). */
export type PrintProviderStatus = 'draft' | 'active' | 'archived';

/** Formato del archivo final que acepta el proveedor. */
export type PrintDeliverable = 'zip-png' | 'pdf-x4' | 'pdf-x1a';

/** Qué sabe/ofrece el proveedor — el eje de MATCHING con la tirada. */
export interface PrintProviderCapabilities {
  /** ¿Ofrece foil / acabado holográfico? */
  foil: boolean;
  /** ¿Foil DISTINTO por carta (dato variable)? Raro; la mayoría hace 1 diseño/lote. */
  foilPerCardVariable?: boolean;
  /** ¿Imprime un dato ÚNICO por carta (QR firmado / serial) vía VDP? */
  uniqueQr?: boolean;
  /** Tamaños soportados, claves libres (p.ej. `poker-63x88`). */
  sizes?: string[];
  /** Pedido mínimo (nº de cartas o de barajas, documentar en `notes`). */
  minOrderQty?: number;
  /** Catálogo de láminas holográficas (rainbow, cracked-ice, confetti…). */
  holographicPatterns?: string[];
}

/** Requisitos de archivo del proveedor — lo que ADAPTA el export. Todo opcional:
 *  ausente = usar el genérico / preguntar. */
export interface PrintProviderFileSpec {
  trimMm?:      { w: number; h: number };
  bleedMm?:     number;
  safeMm?:      number;
  dpi?:         number;
  colorSpace?:  'sRGB' | 'CMYK';
  /** Perfil ICC pactado si es CMYK (p.ej. `FOGRA39`, `GRACoL2006`). */
  iccProfile?:  string;
  /** Cobertura máxima de tinta (Total Area Coverage), %. */
  maxTAC?:      number;
  foilMask?: {
    /** Vector binario (clásico) vs ráster en grises (digital). */
    format?:      'vector' | 'raster';
    /** `true` = negro K100 aplica foil (estándar imprenta). Kromia genera claro=foil → invertir. */
    blackIsFoil?: boolean;
    /** Nombre del spot/plancha de foil que espera el proveedor (`Foil`, `Gold`…). */
    spotName?:    string;
  };
  qr?: {
    /** Tamaño físico mínimo del QR (mm) garantizado escaneable. */
    minMm?:        number;
    ecc?:          'L' | 'M' | 'Q' | 'H';
    /** ¿Deja una ventana MATE (sin foil/barniz brillante) sobre el QR? */
    matteKnockout?: boolean;
  };
  deliverable?: PrintDeliverable;
  /** Formato del dataset de datos variables. */
  vdpDataset?:  'csv' | 'json' | 'none';
  /** Cartones/acabados ofrecidos (texto libre: `black-core 310gsm`, `mate`…). */
  materials?:   string[];
}

/** Perfil completo de un proveedor de impresión curado por el admin. */
export interface PrintProviderProfile {
  id:            string;
  name:          string;
  status:        PrintProviderStatus;
  /** Región/ámbito de envío (texto libre: `EU`, `ES`, `global`…). */
  region?:       string;
  url?:          string;
  contactEmail?: string;
  notes?:        string;
  capabilities:  PrintProviderCapabilities;
  fileSpec:      PrintProviderFileSpec;
  createdAt?:    string;
  updatedAt?:    string;
}

/** Lo que una tirada NECESITA de una imprenta (se deriva del álbum/tirada). */
export interface TiradaPrintNeeds {
  /** ¿Alguna carta lleva foil? */
  hasFoil:       boolean;
  /** ¿El diseño de foil varía entre cartas? */
  foilPerCard?:  boolean;
  /** ¿Lleva QR único por carta (seguimiento por QR)? */
  hasUniqueQr:   boolean;
  /** Clave de tamaño (p.ej. `poker-63x88`). */
  size?:         string;
  /** Nº de cartas físicas de la tirada. */
  quantity?:     number;
}

/** Resultado del match proveedor↔tirada. */
export interface ProviderMatch {
  ok:   boolean;
  /** Requisitos de la tirada que el proveedor NO cubre (vacío ⇒ compatible). */
  gaps: string[];
}

/**
 * ¿Este proveedor puede fabricar esta tirada? Compara requisitos DUROS. Puro y
 * cross-host (Studio lo usa para gatear/avisar; el backend puede reusar el mismo).
 */
export function matchProviderToTirada(
  provider: PrintProviderProfile,
  needs: TiradaPrintNeeds,
): ProviderMatch {
  const gaps: string[] = [];
  const cap = provider.capabilities;
  if (needs.hasFoil && !cap.foil) gaps.push('No ofrece foil / holográfico');
  if (needs.foilPerCard && !cap.foilPerCardVariable) gaps.push('No hace foil distinto por carta (dato variable)');
  if (needs.hasUniqueQr && !cap.uniqueQr) gaps.push('No imprime QR único por carta (VDP)');
  if (
    needs.quantity != null &&
    cap.minOrderQty != null &&
    needs.quantity < cap.minOrderQty
  ) {
    gaps.push(`Pedido mínimo ${cap.minOrderQty} > cantidad de la tirada (${needs.quantity})`);
  }
  if (
    needs.size &&
    cap.sizes &&
    cap.sizes.length > 0 &&
    !cap.sizes.includes(needs.size)
  ) {
    gaps.push(`No soporta el tamaño ${needs.size}`);
  }
  return { ok: gaps.length === 0, gaps };
}
