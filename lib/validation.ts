import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const TOLERANCE = 0.05; // 5% tolerance — friendlier for clients with slight unit/rounding mismatches

function isWithinTolerance(actual: number, expected: number): boolean {
  const tolerance = expected * TOLERANCE;
  return Math.abs(actual - expected) <= tolerance;
}

// Returns true if detected×100 matches expected — i.e. file was made with cm units instead of meters
function matchesAsCentimeters(detectedM: number, expectedM: number): boolean {
  return isWithinTolerance(detectedM * 100, expectedM);
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  detected: {
    widthPx?: number;
    heightPx?: number;
    dpi?: number;
    widthCm?: number;
    heightCm?: number;
    format?: string;
  };
}

export interface FileSpec {
  widthCm?: number | null;
  heightCm?: number | null;
  resolutionDpi?: number | null;
  resolutionDpiMax?: number | null;
  widthPx?: number | null;
  heightPx?: number | null;
  colorMode?: string | null;
}

// Returns 'rgb' | 'cmyk' | 'other' from sharp's metadata.space value
function classifyRasterColorMode(space: string | undefined): 'rgb' | 'cmyk' | 'other' {
  if (!space) return 'other';
  const s = space.toLowerCase();
  if (s === 'cmyk') return 'cmyk';
  if (s === 'srgb' || s === 'rgb' || s === 'rgb16' || s.startsWith('rgb')) return 'rgb';
  return 'other';
}

// Heuristic: scan a PDF buffer for color space declarations
function detectPdfColorMode(buffer: Buffer): 'rgb' | 'cmyk' | 'mixed' | 'unknown' {
  const text = buffer.toString('latin1');
  const hasCmyk = /\/DeviceCMYK|\/CMYK\b/.test(text);
  const hasRgb = /\/DeviceRGB|\/CalRGB|\/sRGB/.test(text);
  if (hasCmyk && hasRgb) return 'mixed';
  if (hasCmyk) return 'cmyk';
  if (hasRgb) return 'rgb';
  return 'unknown';
}

// Returns true if detected matches expected at 1/10 scale (10% proof size)
function matchesAtTenPercent(detectedM: number, expectedM: number): boolean {
  return isWithinTolerance(detectedM * 10, expectedM);
}

// Returns true if DPI is within the spec range (or matches exactly if no range)
function dpiWithinRange(detected: number, min: number, max: number | null): boolean {
  const upper = max ?? min;
  // Allow tolerance at the edges
  const lowerBound = min * (1 - TOLERANCE);
  const upperBound = upper * (1 + TOLERANCE);
  return detected >= lowerBound && detected <= upperBound;
}

export async function validateRasterImage(buffer: Buffer, spec: FileSpec): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return {
      valid: false,
      errors: ['El archivo no es una imagen válida o está corrupto.'],
      warnings: [],
      detected: {},
    };
  }

  const widthPx = metadata.width!;
  const heightPx = metadata.height!;
  const dpi = metadata.density ?? null;
  const detectedColor = classifyRasterColorMode(metadata.space);

  // Color mode check (warning only — don't reject the upload, just inform)
  if (spec.colorMode) {
    const expected = spec.colorMode.toUpperCase();
    if (expected === 'RGB' && detectedColor === 'cmyk') {
      warnings.push('Tu archivo está en CMYK; este producto idealmente debería estar en RGB para visualización digital.');
    } else if (expected === 'CMYK' && detectedColor === 'rgb') {
      warnings.push('Tu archivo está en RGB; para impresión es preferible CMYK. Avisaremos al proveedor para que ajuste si es necesario.');
    }
  }

  // Digital validation: compare pixel dimensions directly
  if (spec.widthPx && spec.heightPx) {
    const orientationSwapped =
      isWithinTolerance(widthPx, spec.heightPx) && isWithinTolerance(heightPx, spec.widthPx);

    if (orientationSwapped) {
      errors.push(
        `Las medidas están invertidas: tu imagen mide ${widthPx}×${heightPx}px ` +
        `pero se requiere ${spec.widthPx}×${spec.heightPx}px. Rota la imagen y vuelve a subir.`
      );
    } else {
      if (!isWithinTolerance(widthPx, spec.widthPx)) {
        errors.push(`Ancho incorrecto: tu imagen mide ${widthPx}px pero se requieren ${spec.widthPx}px.`);
      }
      if (!isWithinTolerance(heightPx, spec.heightPx)) {
        errors.push(`Alto incorrecto: tu imagen mide ${heightPx}px pero se requieren ${spec.heightPx}px.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      detected: { widthPx, heightPx, dpi: dpi ?? undefined, format: metadata.format },
    };
  }

  // Physical validation: cm-based
  if (!spec.widthCm || !spec.heightCm) {
    return { valid: true, errors: [], warnings: ['Este producto no tiene especificaciones configuradas.'], detected: { widthPx, heightPx } };
  }

  const specDpi = spec.resolutionDpi;
  const specDpiMax = spec.resolutionDpiMax ?? null;

  if (specDpi) {
    const dpiLabel = specDpiMax && specDpiMax !== specDpi ? `${specDpi}–${specDpiMax} DPI` : `${specDpi} DPI`;
    // Validate via pixel count = (meters / 0.0254) * DPI — use min DPI as the floor for required pixel count
    const requiredWidthPx = Math.round((spec.widthCm / 0.0254) * specDpi);
    const requiredHeightPx = Math.round((spec.heightCm / 0.0254) * specDpi);
    const effectiveDpi = dpi || specDpi;
    const detectedWidthM = parseFloat(((widthPx / effectiveDpi) * 0.0254).toFixed(3));
    const detectedHeightM = parseFloat(((heightPx / effectiveDpi) * 0.0254).toFixed(3));

    if (dpi === null) {
      warnings.push(
        `Tu archivo no tiene información de resolución (DPI) en sus metadatos. ` +
        `Verificando solo las dimensiones en píxeles. Asegúrate de exportar a ${dpiLabel}.`
      );
    } else if (!dpiWithinRange(dpi, specDpi, specDpiMax)) {
      errors.push(`Resolución fuera de rango: tu archivo tiene ${dpi} DPI pero se requiere ${dpiLabel}.`);
    }

    const orientationSwapped =
      isWithinTolerance(widthPx, requiredHeightPx) && isWithinTolerance(heightPx, requiredWidthPx);

    // Detect cm-interpretation: pixels are 100× smaller than expected (file made in cm)
    const cmInterpretation =
      matchesAsCentimeters(detectedWidthM, spec.widthCm) && matchesAsCentimeters(detectedHeightM, spec.heightCm);

    // Detect 10%-scale interpretation: file is 10x smaller than expected (proof/sample size)
    const tenPercentInterpretation =
      matchesAtTenPercent(detectedWidthM, spec.widthCm) && matchesAtTenPercent(detectedHeightM, spec.heightCm);

    if (cmInterpretation) {
      warnings.push(
        `Tu imagen mide ${(detectedWidthM * 100).toFixed(1)}×${(detectedHeightM * 100).toFixed(1)} cm — las medidas coinciden con lo solicitado, lo aceptamos.`
      );
      return {
        valid: true,
        errors: [],
        warnings,
        detected: { widthPx, heightPx, dpi: dpi ?? undefined, widthCm: detectedWidthM * 100, heightCm: detectedHeightM * 100, format: metadata.format },
      };
    }

    if (tenPercentInterpretation) {
      warnings.push(
        `Tu imagen está al 10% del tamaño real (${(detectedWidthM * 10).toFixed(2)}×${(detectedHeightM * 10).toFixed(2)} m). Aceptado.`
      );
      return {
        valid: true,
        errors: [],
        warnings,
        detected: { widthPx, heightPx, dpi: dpi ?? undefined, widthCm: detectedWidthM * 10, heightCm: detectedHeightM * 10, format: metadata.format },
      };
    }

    if (orientationSwapped) {
      errors.push(
        `Las medidas están invertidas: tu imagen está en formato ${widthPx > heightPx ? 'horizontal' : 'vertical'} ` +
        `pero se requiere en formato ${requiredWidthPx > requiredHeightPx ? 'horizontal' : 'vertical'}. ` +
        `Rota la imagen y vuelve a subir.`
      );
    } else {
      if (!isWithinTolerance(widthPx, requiredWidthPx)) {
        errors.push(
          `Ancho incorrecto: tu imagen mide ${widthPx}px (${detectedWidthM}m) pero se requieren ${requiredWidthPx}px ` +
          `(${spec.widthCm}m a ${specDpi} DPI).`
        );
      }
      if (!isWithinTolerance(heightPx, requiredHeightPx)) {
        errors.push(
          `Alto incorrecto: tu imagen mide ${heightPx}px (${detectedHeightM}m) pero se requieren ${requiredHeightPx}px ` +
          `(${spec.heightCm}m a ${specDpi} DPI).`
        );
      }
    }

    return { valid: errors.length === 0, errors, warnings, detected: { widthPx, heightPx, dpi: dpi ?? undefined, widthCm: detectedWidthM, heightCm: detectedHeightM, format: metadata.format } };
  }

  // No DPI in spec: use detected DPI to infer meters and compare
  if (dpi) {
    const detectedWidthM = parseFloat(((widthPx / dpi) * 0.0254).toFixed(3));
    const detectedHeightM = parseFloat(((heightPx / dpi) * 0.0254).toFixed(3));

    warnings.push(`No hay DPI requerido configurado. Validando medidas a ${dpi} DPI detectado.`);

    const orientationSwapped =
      isWithinTolerance(detectedWidthM, spec.heightCm) && isWithinTolerance(detectedHeightM, spec.widthCm);

    // Detect cm-interpretation here too
    const cmInterpretation =
      matchesAsCentimeters(detectedWidthM, spec.widthCm) && matchesAsCentimeters(detectedHeightM, spec.heightCm);
    const tenPercentInterpretation =
      matchesAtTenPercent(detectedWidthM, spec.widthCm) && matchesAtTenPercent(detectedHeightM, spec.heightCm);

    if (cmInterpretation) {
      warnings.push(
        `Tu imagen mide ${(detectedWidthM * 100).toFixed(1)}×${(detectedHeightM * 100).toFixed(1)} cm — las medidas coinciden con lo solicitado, lo aceptamos.`
      );
      return {
        valid: true,
        errors: [],
        warnings,
        detected: { widthPx, heightPx, dpi, widthCm: detectedWidthM * 100, heightCm: detectedHeightM * 100, format: metadata.format },
      };
    }

    if (tenPercentInterpretation) {
      warnings.push(
        `Tu imagen está al 10% del tamaño real (${(detectedWidthM * 10).toFixed(2)}×${(detectedHeightM * 10).toFixed(2)} m). Aceptado.`
      );
      return {
        valid: true,
        errors: [],
        warnings,
        detected: { widthPx, heightPx, dpi, widthCm: detectedWidthM * 10, heightCm: detectedHeightM * 10, format: metadata.format },
      };
    }

    if (orientationSwapped) {
      errors.push(`Las medidas están invertidas: tu imagen mide ${detectedWidthM}×${detectedHeightM}m pero se requiere ${spec.widthCm}×${spec.heightCm}m.`);
    } else {
      if (!isWithinTolerance(detectedWidthM, spec.widthCm)) {
        errors.push(`Ancho incorrecto: tu imagen mide ${detectedWidthM}m pero se requieren ${spec.widthCm}m.`);
      }
      if (!isWithinTolerance(detectedHeightM, spec.heightCm)) {
        errors.push(`Alto incorrecto: tu imagen mide ${detectedHeightM}m pero se requieren ${spec.heightCm}m.`);
      }
    }

    return { valid: errors.length === 0, errors, warnings, detected: { widthPx, heightPx, dpi, widthCm: detectedWidthM, heightCm: detectedHeightM, format: metadata.format } };
  }

  // No DPI anywhere: can't validate
  warnings.push(
    `No se pudo validar resolución ni dimensiones: el archivo no tiene DPI en sus metadatos y el producto no tiene DPI configurado. ` +
    `El arte fue aceptado pero debes verificar las medidas manualmente.`
  );
  return { valid: true, errors: [], warnings, detected: { widthPx, heightPx, format: metadata.format } };
}

export async function validatePDF(buffer: Buffer, spec: FileSpec): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!spec.widthCm || !spec.heightCm) {
    return { valid: true, errors: [], warnings: ['Este producto no tiene especificaciones configuradas.'], detected: {} };
  }

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  } catch {
    return {
      valid: false,
      errors: ['El archivo PDF no es válido o está corrupto. Asegúrate de subir un PDF correcto.'],
      warnings: [],
      detected: {},
    };
  }

  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    return { valid: false, errors: ['El PDF no contiene páginas.'], warnings: [], detected: {} };
  }

  if (pages.length > 1) {
    warnings.push(`El PDF tiene ${pages.length} páginas. Solo se valida la primera página.`);
  }

  const page = pages[0];
  const { width: widthPts, height: heightPts } = page.getSize();
  const POINTS_PER_INCH = 72;
  const CM_PER_INCH = 2.54;

  // PDF points → meters (1 pt = 1/72 inch; 1 inch = 0.0254 m)
  const detectedWidthM = parseFloat(((widthPts / POINTS_PER_INCH) * CM_PER_INCH / 100).toFixed(3));
  const detectedHeightM = parseFloat(((heightPts / POINTS_PER_INCH) * CM_PER_INCH / 100).toFixed(3));

  const orientationSwapped =
    isWithinTolerance(detectedWidthM, spec.heightCm) && isWithinTolerance(detectedHeightM, spec.widthCm);

  // Detect if the file was made in cm instead of meters (numbers match at 100x scale)
  const cmInterpretation =
    matchesAsCentimeters(detectedWidthM, spec.widthCm) && matchesAsCentimeters(detectedHeightM, spec.heightCm);
  const cmInterpretationSwapped =
    matchesAsCentimeters(detectedWidthM, spec.heightCm) && matchesAsCentimeters(detectedHeightM, spec.widthCm);

  // Detect 10% scale (proof size)
  const tenPercentInterpretation =
    matchesAtTenPercent(detectedWidthM, spec.widthCm) && matchesAtTenPercent(detectedHeightM, spec.heightCm);
  const tenPercentSwapped =
    matchesAtTenPercent(detectedWidthM, spec.heightCm) && matchesAtTenPercent(detectedHeightM, spec.widthCm);

  if (cmInterpretation || cmInterpretationSwapped) {
    warnings.push(
      `Tu PDF mide ${(detectedWidthM * 100).toFixed(1)}×${(detectedHeightM * 100).toFixed(1)} cm — las medidas coinciden con lo solicitado, lo aceptamos.`
    );
    if (cmInterpretationSwapped) {
      warnings.push('La orientación está invertida pero los valores coinciden — verifica la rotación antes de imprimir.');
    }
    return {
      valid: true,
      errors: [],
      warnings,
      detected: { widthCm: detectedWidthM * 100, heightCm: detectedHeightM * 100, format: 'pdf' },
    };
  }

  if (tenPercentInterpretation || tenPercentSwapped) {
    warnings.push(
      `Tu PDF está al 10% del tamaño real (${(detectedWidthM * 10).toFixed(2)}×${(detectedHeightM * 10).toFixed(2)} m). Aceptado.`
    );
    if (tenPercentSwapped) {
      warnings.push('La orientación está invertida — verifica la rotación antes de imprimir.');
    }
    return {
      valid: true,
      errors: [],
      warnings,
      detected: { widthCm: detectedWidthM * 10, heightCm: detectedHeightM * 10, format: 'pdf' },
    };
  }

  if (orientationSwapped) {
    errors.push(
      `Las medidas del PDF están invertidas: mide ${detectedWidthM}×${detectedHeightM}m ` +
      `pero se requiere ${spec.widthCm}×${spec.heightCm}m. Rota la página y vuelve a exportar.`
    );
  } else {
    if (!isWithinTolerance(detectedWidthM, spec.widthCm)) {
      errors.push(`Ancho incorrecto: tu PDF mide ${detectedWidthM}m pero se requieren ${spec.widthCm}m.`);
    }
    if (!isWithinTolerance(detectedHeightM, spec.heightCm)) {
      errors.push(`Alto incorrecto: tu PDF mide ${detectedHeightM}m pero se requieren ${spec.heightCm}m.`);
    }
  }

  if (spec.resolutionDpi) {
    warnings.push(`Los PDFs no almacenan DPI de forma estándar. Asegúrate de que tu PDF fue exportado a ${spec.resolutionDpi} DPI.`);
  }

  // Color mode check for PDFs (warning only — don't reject the upload)
  if (spec.colorMode) {
    const expected = spec.colorMode.toUpperCase();
    const detected = detectPdfColorMode(buffer);
    if (expected === 'CMYK' && detected === 'rgb') {
      warnings.push('Tu PDF está en RGB; para impresión es preferible CMYK. Avisaremos al proveedor para que ajuste si es necesario.');
    } else if (expected === 'RGB' && detected === 'cmyk') {
      warnings.push('Tu PDF está en CMYK; este producto idealmente debería estar en RGB.');
    } else if (expected === 'CMYK' && detected === 'mixed') {
      warnings.push('Tu PDF tiene contenido en CMYK y RGB mezclados.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detected: { widthCm: detectedWidthM, heightCm: detectedHeightM, format: 'pdf' },
  };
}

export async function validateFile(buffer: Buffer, mimeType: string, spec: FileSpec): Promise<ValidationResult> {
  if (mimeType === 'application/pdf') {
    return validatePDF(buffer, spec);
  }
  if (mimeType.startsWith('image/')) {
    return validateRasterImage(buffer, spec);
  }
  return {
    valid: false,
    errors: ['Formato de archivo no soportado.'],
    warnings: [],
    detected: {},
  };
}
