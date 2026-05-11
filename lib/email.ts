import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'produccion@tuempresa.com';
const NOTIFICATION_EMAILS = (process.env.NOTIFICATION_EMAILS || FROM).split(',').map(e => e.trim());

export interface UploadEmailInfo {
  filename: string;
  downloadUrl: string;
  fileFormat: string | null; // 'jpg', 'png', 'pdf', 'psd', 'mp4'
  detectedWidthCm?: string | null;
  detectedHeightCm?: string | null;
  detectedDpi?: number | null;
  thumbnailBase64?: string; // JPEG thumbnail, base64 encoded
}

export async function sendOrderReadyNotification(params: {
  orderNumber: string;
  clientName: string;
  itemCount: number;
  dashboardUrl: string;
  uploads?: UploadEmailInfo[];
}): Promise<void> {
  const { orderNumber, clientName, itemCount, dashboardUrl, uploads = [] } = params;

  // Build Resend inline attachments for image thumbnails
  const attachments = uploads
    .filter(u => u.thumbnailBase64)
    .map((u, i) => ({
      filename: `thumb_${i}.jpg`,
      content: u.thumbnailBase64!,
      content_id: `thumb_${i}`,
      content_type: 'image/jpeg',
    }));

  const fileRows = uploads.map((u, i) => {
    const isImage = u.fileFormat === 'jpg' || u.fileFormat === 'png';
    const thumbHtml = isImage && u.thumbnailBase64
      ? `<img src="cid:thumb_${i}" width="80" height="60" style="object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;display:block;" />`
      : `<div style="width:80px;height:60px;background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-size:22px;">${u.fileFormat === 'pdf' ? '📄' : '🎨'}</div>`;

    const dims = u.detectedWidthCm
      ? `${u.detectedWidthCm} × ${u.detectedHeightCm} m${u.detectedDpi ? ` &nbsp;·&nbsp; ${u.detectedDpi} DPI` : ''}`
      : '';

    return `
      <tr>
        <td style="padding:10px 8px;vertical-align:middle;border-bottom:1px solid #f3f4f6;">${thumbHtml}</td>
        <td style="padding:10px 12px;vertical-align:middle;border-bottom:1px solid #f3f4f6;">
          <div style="font-size:13px;font-weight:600;color:#111827;word-break:break-all;">${u.filename}</div>
          ${dims ? `<div style="font-size:11px;color:#6b7280;margin-top:3px;">${dims}</div>` : ''}
        </td>
        <td style="padding:10px 8px;vertical-align:middle;border-bottom:1px solid #f3f4f6;white-space:nowrap;text-align:right;">
          <a href="${u.downloadUrl}"
             style="display:inline-block;background:#B03060;color:#ffffff;padding:6px 14px;border-radius:5px;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.01em;">
            Descargar
          </a>
        </td>
      </tr>`;
  }).join('');

  const filesSection = uploads.length > 0 ? `
    <div style="margin-top:20px;">
      <p style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px 0;">
        Archivos (${uploads.length}) — links válidos por 7 días
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:collapse;">
        ${fileRows}
      </table>
    </div>` : '';

  await resend.emails.send({
    from: FROM,
    to: NOTIFICATION_EMAILS,
    subject: `Arte listo para producción: ${orderNumber}`,
    attachments: attachments.length > 0 ? attachments : undefined,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;color:#111827;">

        <div style="border-top:3px solid #B03060;border-radius:8px 8px 0 0;"></div>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:20px 24px 24px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
            <div style="width:36px;height:36px;background:#ecfdf5;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;">✅</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#111827;">Arte recibido y validado</div>
              <div style="font-size:12px;color:#6b7280;margin-top:1px;">Pedido ${orderNumber} listo para producción</div>
            </div>
          </div>

          <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 6px 0;">
            El cliente <strong>${clientName}</strong> ha enviado
            <strong>${itemCount} arte${itemCount !== 1 ? 's' : ''}</strong> con medidas validadas.
          </p>
          <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 18px 0;">
            Puedes descargar los archivos desde los botones a continuación o desde el dashboard.
          </p>

          ${filesSection}

          <div style="margin-top:22px;">
            <a href="${dashboardUrl}"
               style="display:inline-block;background:#111827;color:#ffffff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:700;">
              Ver pedido en el Dashboard →
            </a>
          </div>
        </div>

        <p style="font-size:11px;color:#9ca3af;margin-top:20px;text-align:center;">
          Pink Connections · Sistema de Artes OOH
        </p>
      </body>
      </html>
    `,
  });
}

export async function sendToPrintNotification(params: {
  supplierName: string;
  supplierEmail: string;
  orderNumber: string;
  clientName: string;
  items: {
    productName: string;
    productCode: string;
    quantity: number;
    material: string | null;
    widthCm: string | null;
    heightCm: string | null;
    widthPx: number | null;
    heightPx: number | null;
    colorMode: string | null;
    filename: string | null;
    downloadUrl: string | null;
  }[];
}): Promise<void> {
  const { supplierName, supplierEmail, orderNumber, clientName, items } = params;

  const itemRows = items.map(item => {
    const dims = item.widthPx
      ? `${item.widthPx} × ${item.heightPx} px`
      : item.widthCm
        ? `${parseFloat(item.widthCm)} × ${parseFloat(item.heightCm ?? '0')} m`
        : '—';

    const downloadBtn = item.downloadUrl
      ? `<a href="${item.downloadUrl}" style="display:inline-block;background:#B03060;color:#fff;padding:6px 14px;border-radius:5px;text-decoration:none;font-size:12px;font-weight:700;">Descargar arte</a>`
      : '<span style="font-size:12px;color:#9ca3af;">Sin archivo</span>';

    return `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:12px 14px;vertical-align:top;">
          <div style="font-size:13px;font-weight:600;color:#111827;">${item.productName}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">Código: ${item.productCode}</div>
          ${item.material ? `<div style="font-size:11px;color:#6b7280;margin-top:1px;">Material: ${item.material}</div>` : ''}
        </td>
        <td style="padding:12px 14px;vertical-align:top;white-space:nowrap;">
          <div style="font-size:13px;color:#374151;">${dims}</div>
          ${item.colorMode ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${item.colorMode}</div>` : ''}
        </td>
        <td style="padding:12px 14px;vertical-align:top;text-align:center;">
          <div style="font-size:13px;font-weight:600;color:#374151;">×${item.quantity}</div>
        </td>
        <td style="padding:12px 14px;vertical-align:top;text-align:right;">${downloadBtn}</td>
      </tr>`;
  }).join('');

  await resend.emails.send({
    from: FROM,
    to: supplierEmail,
    subject: `Orden de impresión: ${orderNumber} — Pink Connections`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#ffffff;color:#111827;">
        <div style="border-top:3px solid #B03060;border-radius:8px 8px 0 0;"></div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">

          <div style="margin-bottom:20px;">
            <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:4px;">Orden de impresión</div>
            <div style="font-size:13px;color:#6b7280;">Pedido <strong>${orderNumber}</strong> · Cliente: <strong>${clientName}</strong></div>
          </div>

          <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px 0;">
            Hola <strong>${supplierName}</strong>, adjuntamos los artes aprobados para producción. Por favor descarga cada archivo y procede con la impresión según las especificaciones indicadas.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:collapse;background:#ffffff;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Producto</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Medidas</th>
                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Cant.</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Arte</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <p style="font-size:12px;color:#9ca3af;margin-top:16px;">Los links de descarga son válidos por 7 días.</p>
        </div>
        <p style="font-size:11px;color:#9ca3af;margin-top:20px;text-align:center;">
          Pink Connections · Sistema de Artes OOH
        </p>
      </body>
      </html>
    `,
  });
}

export async function sendClientUploadLink(params: {
  clientEmail: string;
  clientName: string;
  orderNumber: string;
  portalUrl: string;
  expiresAt: Date;
}): Promise<void> {
  const expiresStr = params.expiresAt.toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  await resend.emails.send({
    from: FROM,
    to: params.clientEmail,
    subject: `Sube tu arte para el pedido ${params.orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">
        <div style="border-top:3px solid #B03060;border-radius:8px 8px 0 0;"></div>
        <div style="padding:24px 0;">
          <h2 style="color:#111827;margin:0 0 12px 0;">Hola, ${params.clientName}</h2>
          <p style="color:#374151;font-size:14px;line-height:1.6;">
            Tu pedido <strong>${params.orderNumber}</strong> está listo para recibir los artes de publicidad.
          </p>
          <p style="color:#374151;font-size:14px;line-height:1.6;">
            Por favor sube tus archivos a través del siguiente enlace. El sistema validará automáticamente
            que las medidas y la resolución sean las correctas para tu campaña.
          </p>
          <a href="${params.portalUrl}"
             style="display:inline-block;background:#B03060;color:white;padding:14px 28px;
                    border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0;">
            Subir mi Arte
          </a>
          <p style="color:#6b7280;font-size:13px;">
            Este enlace vence el <strong>${expiresStr}</strong>.
          </p>
          <p style="color:#6b7280;font-size:13px;">
            Si tienes dudas sobre las especificaciones, el portal te mostrará exactamente qué necesitas subir.
          </p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;" />
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px;">
          Pink Connections · Si no solicitaste este enlace, ignora este correo.
        </p>
      </body>
      </html>
    `,
  });
}
