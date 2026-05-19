'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

interface Spec {
  id: number;
  widthCm: string | null;
  heightCm: string | null;
  widthVisibleCm: string | null;
  heightVisibleCm: string | null;
  resolutionDpi: number | null;
  widthPx: number | null;
  heightPx: number | null;
  colorMode: string | null;
  acceptedFormats: string | null;
  notes: string | null;
}

interface UploadRecord {
  id: number;
  status: string;
  filenameOriginal: string;
  validationErrors: string[] | null;
  detectedWidthCm: string | null;
  detectedHeightCm: string | null;
  detectedDpi: number | null;
}

interface PortalItem {
  id: number;
  productCode: string;
  productName: string;
  quantity: number;
  specId: number | null;
  spec: Spec | null;
  latestUpload: UploadRecord | null;
}

interface PortalData {
  link: { uuid: string; expiresAt: string; allUploadedAt: string | null };
  order: { odooOrderId: string; clientName: string };
  items: PortalItem[];
}

function IconScreen() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
    </svg>
  );
}

function IconPrint() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17H7A5 5 0 017 7h10a5 5 0 010 10h-2M9 17h6M9 17v4h6v-4" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
}

function IconError() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  );
}

function SpecCard({ spec }: { spec: Spec }) {
  const isDigital = !!spec.widthPx;

  if (isDigital) {
    return (
      <div className="mt-4 rounded-xl overflow-hidden border border-sky-100">
        <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-100 flex items-center gap-2 text-sky-600">
          <IconScreen />
          <span className="text-xs font-semibold uppercase tracking-wider">Pantalla digital</span>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Resolución exacta</p>
          <p className="font-[family-name:var(--font-outfit)] text-3xl font-bold text-gray-900 leading-none">
            {spec.widthPx}
            <span className="text-xl text-gray-300 mx-2 font-light">×</span>
            {spec.heightPx}
            <span className="text-base text-gray-500 font-medium ml-2">px</span>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            El archivo debe tener exactamente esta resolución en píxeles.
          </p>
        </div>
        {(spec.acceptedFormats || spec.notes) && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {spec.acceptedFormats && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-gray-400">Formato</span>
                  <span className="font-bold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md">{spec.acceptedFormats}</span>
                </div>
              )}
              {spec.notes && <span className="text-xs text-gray-500 italic">{spec.notes}</span>}
            </div>
            {spec.acceptedFormats && (
              <p className="text-xs text-gray-400">Sube tu archivo únicamente en este formato — no se aceptan otros.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  const totalW = parseFloat(spec.widthCm!);
  const totalH = parseFloat(spec.heightCm!);
  const visW = spec.widthVisibleCm ? parseFloat(spec.widthVisibleCm) : null;
  const visH = spec.heightVisibleCm ? parseFloat(spec.heightVisibleCm) : null;
  const hasVisible = visW !== null && visH !== null;

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-[#B03060]/15">
      <div className="px-4 py-2.5 bg-[#B03060]/5 border-b border-[#B03060]/10 flex items-center gap-2 text-[#B03060]">
        <IconPrint />
        <span className="text-xs font-semibold uppercase tracking-wider">Impresión física</span>
      </div>
      <div className={`bg-white ${hasVisible ? 'grid grid-cols-2 divide-x divide-gray-100' : ''}`}>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Tamaño del arte</p>
          <p className="font-[family-name:var(--font-outfit)] text-2xl font-bold text-gray-900 leading-none">
            {totalW}
            <span className="text-lg text-gray-300 mx-1.5 font-light">×</span>
            {totalH}
            <span className="text-sm text-gray-500 font-medium ml-1.5">m</span>
          </p>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            Tu archivo debe tener estas dimensiones exactas. El área de sangrado es el margen extra que se recorta al instalar.
          </p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Las medidas están en <strong>metros</strong>, pero si tu archivo viene en centímetros también lo aceptamos automáticamente.
          </p>
        </div>
        {hasVisible && (
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-amber-500 uppercase tracking-wider mb-1.5">Zona visible</p>
            <p className="font-[family-name:var(--font-outfit)] text-2xl font-bold text-gray-900 leading-none">
              {visW}
              <span className="text-lg text-gray-300 mx-1.5 font-light">×</span>
              {visH}
              <span className="text-sm text-gray-500 font-medium ml-1.5">m</span>
            </p>
            <p className="text-xs text-amber-600 mt-1.5 leading-relaxed">
              Textos, logos e imágenes importantes deben quedar dentro de esta zona — lo que esté afuera puede no verse.
            </p>
          </div>
        )}
      </div>
      {(spec.acceptedFormats || spec.resolutionDpi || spec.notes) && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {spec.acceptedFormats && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-400">Formato</span>
                <span className="font-bold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md">{spec.acceptedFormats}</span>
              </div>
            )}
            {spec.resolutionDpi && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-400">Resolución</span>
                <span className="font-semibold text-gray-700">{spec.resolutionDpi} DPI</span>
              </div>
            )}
            {spec.notes && <span className="text-xs text-gray-500 italic">{spec.notes}</span>}
          </div>
          {spec.acceptedFormats && (
            <p className="text-xs text-gray-400">Sube tu archivo únicamente en este formato — no se aceptan otros.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ItemCard({
  item,
  linkUuid,
  onValidated,
  allDone,
}: {
  item: PortalItem;
  linkUuid: string;
  onValidated: () => void;
  allDone: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'validating' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uploadedFilename, setUploadedFilename] = useState('');

  const isValid = item.latestUpload?.status === 'valid' || phase === 'success';
  const isBusy = phase === 'uploading' || phase === 'validating';

  function getAllowedMimes(acceptedFormats: string | null | undefined): string[] {
    if (!acceptedFormats) return ['image/png', 'image/jpeg', 'application/pdf'];
    const fmt = acceptedFormats.toUpperCase();
    const types: string[] = [];
    if (fmt.includes('JPG') || fmt.includes('JPEG')) types.push('image/jpeg', 'image/png');
    if (fmt.includes('PNG')) types.push('image/png');
    if (fmt.includes('PDF')) types.push('application/pdf');
    if (fmt.includes('PSD')) types.push('image/vnd.adobe.photoshop', 'image/x-photoshop', 'image/psd', 'application/photoshop');
    if (fmt.includes('MP4')) types.push('video/mp4');
    return types.length > 0 ? [...new Set(types)] : ['image/jpeg', 'image/png', 'application/pdf'];
  }

  async function handleFile(file: File) {
    if (isBusy || isValid || allDone) return;

    const ALLOWED = getAllowedMimes(item.spec?.acceptedFormats);
    if (!ALLOWED.includes(file.type)) {
      setPhase('error');
      setErrors([`Formato no válido. Este producto acepta: ${item.spec?.acceptedFormats || 'JPG, PDF'}.`]);
      return;
    }

    setPhase('uploading');
    setErrors([]);
    setWarnings([]);
    setUploadedFilename(file.name);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('orderItemId', String(item.id));

    let uploadRes: Response | null = null;
    try {
      uploadRes = await fetch(`/api/portal/${linkUuid}/upload`, {
        method: 'POST',
        body: formData,
      });
    } catch {
      setPhase('error');
      setErrors(['No se pudo conectar. Revisa tu conexión e intenta de nuevo.']);
      return;
    }

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      setPhase('error');
      setErrors([err?.error || 'Error al subir el archivo. Intenta de nuevo.']);
      return;
    }

    const result = await uploadRes.json();

    if (result.valid) {
      setPhase('success');
      setWarnings(result.warnings || []);
      onValidated();
    } else {
      setPhase('error');
      setErrors(result.errors || ['El archivo no cumple con las especificaciones.']);
      setWarnings(result.warnings || []);
    }
  }

  const acceptAttr = item.spec?.acceptedFormats
    ? item.spec.acceptedFormats.toUpperCase().split(/[,/\s]+o\s+|[,/\s]+/).map(f => {
        const m: Record<string, string> = { JPG: '.jpg,.jpeg', JPEG: '.jpg,.jpeg', PNG: '.png', PDF: '.pdf', PSD: '.psd', MP4: '.mp4' };
        return m[f.trim()] || '';
      }).filter(Boolean).join(',')
    : '.png,.jpg,.jpeg,.pdf';

  return (
    <div className={`rounded-2xl border bg-white overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all duration-200 ${
      isValid ? 'border-emerald-200' : phase === 'error' ? 'border-red-200' : 'border-gray-100'
    }`}>
      {isValid && <div className="h-0.5 bg-emerald-400" />}
      {phase === 'error' && <div className="h-0.5 bg-red-400" />}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <span className="inline-block font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md mb-2">
              {item.productCode}
            </span>
            <h3 className="text-base font-semibold text-gray-900 leading-snug">
              {item.productName.replace(/^\[[^\]]+\]\s*/, '')}
            </h3>
            {item.quantity > 1 && (
              <p className="text-xs text-gray-400 mt-0.5">Cantidad: {item.quantity}</p>
            )}
          </div>
          {isValid && (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full shrink-0">
              <IconCheck className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">Aceptado</span>
            </div>
          )}
        </div>

        {/* Spec card */}
        {item.spec && !isValid && <SpecCard spec={item.spec} />}

        {/* No spec warning */}
        {!item.specId && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
            <span className="text-amber-500 mt-0.5"><IconWarning /></span>
            <div>
              <p className="text-xs font-semibold text-amber-800">Sin especificaciones configuradas</p>
              <p className="text-xs text-amber-600 mt-0.5">Sube tu arte y nuestro equipo lo revisará manualmente.</p>
            </div>
          </div>
        )}

        {/* Valid: show file info */}
        {isValid && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-800">Archivo validado correctamente</p>
              <p className="text-xs text-emerald-600 truncate mt-0.5">
                {item.latestUpload?.filenameOriginal || uploadedFilename}
              </p>
            </div>
          </div>
        )}

        {/* Upload zone */}
        {!isValid && !allDone && (
          <div
            className={`mt-4 border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-all duration-150 select-none ${
              dragging
                ? 'border-[#B03060] bg-[#B03060]/5'
                : phase === 'error'
                ? 'border-red-200 hover:border-red-300 bg-red-50/40'
                : 'border-gray-200 hover:border-[#B03060]/40 hover:bg-gray-50/60'
            } ${isBusy ? 'pointer-events-none opacity-60' : ''}`}
            onDragOver={e => { e.preventDefault(); if (!isBusy) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => { if (!isBusy) inputRef.current?.click(); }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={acceptAttr}
              className="hidden"
              disabled={isBusy}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />
            {isBusy ? (
              <div>
                <div className="w-8 h-8 border-2 border-[#B03060]/20 border-t-[#B03060] rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700">
                  {phase === 'uploading' ? 'Subiendo archivo...' : 'Validando medidas...'}
                </p>
                {uploadedFilename && (
                  <p className="text-xs text-gray-400 mt-1 truncate max-w-[220px] mx-auto">{uploadedFilename}</p>
                )}
              </div>
            ) : (
              <div>
                <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center transition-colors ${
                  dragging ? 'bg-[#B03060]/10 text-[#B03060]' : 'bg-gray-100 text-gray-400'
                }`}>
                  <IconUpload />
                </div>
                <p className="text-sm font-semibold text-gray-800">
                  {phase === 'error' ? 'Subir otro archivo' : 'Arrastra tu archivo aquí'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  o{' '}
                  <span className="text-[#B03060] font-medium">haz clic para seleccionar</span>
                  {item.spec?.acceptedFormats && ` · ${item.spec.acceptedFormats}`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Errors */}
        {phase === 'error' && errors.length > 0 && (
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="flex items-center gap-2 mb-2 text-red-600">
              <IconError />
              <p className="text-sm font-semibold">El archivo no cumple las especificaciones</p>
            </div>
            <ul className="space-y-1 pl-6">
              {errors.map((err, i) => (
                <li key={i} className="text-sm text-red-600 list-disc list-outside">{err}</li>
              ))}
            </ul>
            <p className="text-xs text-red-400 mt-2.5 pl-6">Corrige el archivo y vuelve a subirlo.</p>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 space-y-1.5">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-amber-700">
                <span className="mt-0.5"><IconWarning /></span>
                <p className="text-xs">{w}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortalPage() {
  const params = useParams();
  const uuid = params.uuid as string;

  const [data, setData] = useState<PortalData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [validatedItems, setValidatedItems] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchPortal = useCallback(async () => {
    const res = await fetch(`/api/portal/${uuid}`);
    const json = await res.json();
    if (!res.ok) {
      setLoadError(json.error || 'Error al cargar el portal');
    } else {
      setData(json);
      const alreadyValid = new Set<number>(
        json.items
          .filter((item: PortalItem) => item.latestUpload?.status === 'valid')
          .map((item: PortalItem) => item.id)
      );
      setValidatedItems(alreadyValid);
    }
    setLoading(false);
  }, [uuid]);

  useEffect(() => { fetchPortal(); }, [fetchPortal]);

  function handleItemValidated(itemId: number) {
    setValidatedItems(prev => new Set([...prev, itemId]));
    fetchPortal();
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/portal/${uuid}/submit`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || 'Error al enviar. Intenta de nuevo.');
        setSubmitting(false);
        return;
      }
      await fetchPortal();
    } catch {
      setSubmitError('Sin conexión. Intenta de nuevo.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F4F2] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#B03060]/20 border-t-[#B03060] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F4F2] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-10">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Link no disponible</h2>
          <p className="text-sm text-gray-500">{loadError}</p>
          <p className="text-xs text-gray-400 mt-5 leading-relaxed">
            Contacta a tu agente de ventas para obtener un nuevo link.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalItems = data.items.length;
  const validCount = data.items.filter(i => i.latestUpload?.status === 'valid').length +
    [...validatedItems].filter(id => !data.items.find(i => i.id === id && i.latestUpload?.status === 'valid')).length;

  const isCompleted = !!data.link.allUploadedAt;
  const allReadyToSubmit = totalItems > 0 && validatedItems.size >= totalItems;
  const progress = totalItems > 0 ? validatedItems.size / totalItems : 0;

  return (
    <div className="min-h-[100dvh] bg-[#F5F4F2]">
      {/* Header */}
      <div className="sticky top-0 z-10">
        <div className="h-1 bg-[#B03060]" />
        <header className="bg-white border-b border-gray-100 shadow-[0_2px_12px_rgba(176,48,96,0.07)]">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <img src="/logo-icon.png" alt="Pink" className="h-10 w-10 object-contain shrink-0" />
            <span className="font-[family-name:var(--font-outfit)] font-bold text-base text-gray-900 leading-none tracking-tight hidden sm:block">
              Pink <span className="font-normal text-gray-400">Connections</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            {totalItems > 1 && (
              <div className="hidden sm:flex items-center gap-2.5">
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#B03060] rounded-full transition-all duration-500"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 tabular-nums">{validatedItems.size}/{totalItems}</span>
              </div>
            )}
            <div className="text-right">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider leading-none">Pedido</p>
              <p className="text-sm font-bold text-gray-900 font-mono leading-tight mt-0.5">{data.order.odooOrderId}</p>
            </div>
          </div>
        </div>
        </header>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8 pb-16">
        {isCompleted ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-emerald-100">
              <IconCheck className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Artes recibidos</h2>
            <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
              Todos los archivos fueron validados. Nuestro equipo de producción ya los recibió y los está revisando.
            </p>
            <p className="text-sm text-gray-400 max-w-xs mx-auto mt-3 leading-relaxed">
              En breve tu ejecutivo de cuenta te confirmará que todo está listo para producción.
            </p>
            {process.env.NEXT_PUBLIC_CONTACT_EMAIL && (
              <p className="text-xs text-gray-400 mt-4">
                ¿Tienes dudas?{' '}
                <a
                  href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`}
                  className="text-[#B03060] font-medium underline underline-offset-2"
                >
                  {process.env.NEXT_PUBLIC_CONTACT_EMAIL}
                </a>
              </p>
            )}
            <p className="text-xs text-gray-400 mt-6">Gracias, {data.order.clientName}.</p>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <h1 className="text-xl font-bold text-gray-900">Hola, {data.order.clientName}</h1>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Sube el arte de cada producto. El sistema valida las medidas automáticamente.
              </p>

              {/* Mini process guide */}
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-semibold text-[10px] shrink-0">1</span>
                  Revisa las medidas
                </div>
                <span className="text-gray-200">›</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-semibold text-[10px] shrink-0">2</span>
                  Prepara tu arte
                </div>
                <span className="text-gray-200">›</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-semibold text-[10px] shrink-0">3</span>
                  Sube y listo
                </div>
              </div>

              {totalItems > 1 && (
                <div className="mt-4 flex items-center gap-2.5 sm:hidden">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#B03060] rounded-full transition-all duration-500"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 tabular-nums shrink-0">{validatedItems.size} de {totalItems}</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {data.items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  linkUuid={uuid}
                  onValidated={() => handleItemValidated(item.id)}
                  allDone={isCompleted}
                />
              ))}
            </div>

            {/* Submit section */}
            <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {allReadyToSubmit
                      ? 'Todos los artes están listos'
                      : `${validatedItems.size} de ${totalItems} arte${totalItems !== 1 ? 's' : ''} validado${validatedItems.size !== 1 ? 's' : ''}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {allReadyToSubmit
                      ? 'Puedes enviar los artes al equipo de producción.'
                      : 'Sube y valida todos los artes para poder enviar.'}
                  </p>
                  {submitError && (
                    <p className="text-xs text-red-500 mt-1.5 font-medium">{submitError}</p>
                  )}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!allReadyToSubmit || submitting}
                  className={`shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all
                    ${allReadyToSubmit && !submitting
                      ? 'bg-[#B03060] text-white hover:bg-[#95284F] shadow-sm hover:shadow-md active:scale-95'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Enviar artes
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-10 leading-relaxed">
              Este link vence el{' '}
              <span className="font-medium text-gray-500">
                {new Date(data.link.expiresAt).toLocaleDateString('es-MX', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
              .{' '}
              {process.env.NEXT_PUBLIC_CONTACT_EMAIL ? (
                <>
                  ¿Dudas? Escríbenos a{' '}
                  <a
                    href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`}
                    className="text-[#B03060] font-medium underline-offset-2 hover:underline"
                  >
                    {process.env.NEXT_PUBLIC_CONTACT_EMAIL}
                  </a>
                </>
              ) : (
                'Para soporte, contacta a tu ejecutivo de cuenta.'
              )}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
