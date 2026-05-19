import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const TOLERANCE = 0.03; // 3% tolerance

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
  widthPx?: number | null;
  heightPx?: number | null;
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

  if (specDpi) {
    // Validate via pixel count = (meters / 0.0254) * DPI
    const requiredWidthPx = Math.round((spec.widthCm / 0.0254) * specDpi);
    const requiredHeightPx = Math.round((spec.heightCm / 0.0254) * specDpi);
    const effectiveDpi = dpi || specDpi;
    const detectedWidthM = parseFloat(((widthPx / effectiveDpi) * 0.0254).toFixed(3));
    const detectedHeightM = parseFloat(((heightPx / effectiveDpi) * 0.0254).toFixed(3));

    if (dpi === null) {
      warnings.push(
        `Tu archivo no tiene información de resolución (DPI) en sus metadatos. ` +
        `Verificando solo las dimensiones en píxeles. Asegúrate de exportar a ${specDpi} DPI.`
      );
    } else if (!isWithinTolerance(dpi, specDpi)) {
      errors.push(`Resolución incorrecta: tu archivo tiene ${dpi} DPI pero se requieren ${specDpi} DPI.`);
    }

    const orientationSwapped =
      isWithinTolerance(widthPx, requiredHeightPx) && isWithinTolerance(heightPx, requiredWidthPx);

    // Detect cm-interpretation: pixels are 100× smaller than expected (file made in cm)
    const cmInterpretation =
      matchesAsCentimeters(detectedWidthM, spec.widthCm) && matchesAsCentimeters(detectedHeightM, spec.heightCm);

    if (cmInterpretation) {
      warnings.push(
        `Tu imagen fue exportada con medidas en centímetros (${(detectedWidthM * 100).toFixed(1)}×${(detectedHeightM * 100).toFixed(1)} cm) ` +
        `en vez de metros. Los valores coinciden, lo aceptamos automáticamente. Recomendamos exportar en metros.`
      );
      return {
        valid: true,
        errors: [],
        warnings,
        detected: { widthPx, heightPx, dpi: dpi ?? undefined, widthCm: detectedWidthM * 100, heightCm: detectedHeightM * 100, format: metadata.format },
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

    if (cmInterpretation) {
      warnings.push(
        `Tu imagen fue exportada en centímetros (${(detectedWidthM * 100).toFixed(1)}×${(detectedHeightM * 100).toFixed(1)} cm) ` +
        `en vez de metros. Los valores coinciden, lo aceptamos automáticamente.`
      );
      return {
        valid: true,
        errors: [],
        warnings,
        detected: { widthPx, heightPx, dpi, widthCm: detectedWidthM * 100, heightCm: detectedHeightM * 100, format: metadata.format },
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

  if (cmInterpretation || cmInterpretationSwapped) {
    // Accept with warning — client likely used cm as the unit instead of meters
    warnings.push(
      `Tu PDF fue exportado en centímetros (${detectedWidthM * 100}×${detectedHeightM * 100} cm) en vez de metros. ` +
      `Las medidas coinciden con lo requerido, lo aceptamos automáticamente. Recomendamos exportar en metros para evitar confusiones.`
    );
    if (cmInterpretationSwapped) {
      warnings.push('La orientación del PDF está invertida pero los valores coinciden — verifica que la rotación sea correcta antes de imprimir.');
    }
    return {
      valid: true,
      errors: [],
      warnings,
      detected: { widthCm: detectedWidthM * 100, heightCm: detectedHeightM * 100, format: 'pdf' },
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
