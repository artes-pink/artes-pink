import xmlrpc from 'xmlrpc';

const ODOO_URL = process.env.ODOO_URL!.trim();
const ODOO_DB = process.env.ODOO_DB!.trim();
const ODOO_USER = process.env.ODOO_USERNAME!.trim();
const ODOO_PASS = process.env.ODOO_PASSWORD!.trim();

function createClient(path: string) {
  const url = new URL(ODOO_URL);
  const isHttps = url.protocol === 'https:';
  const createFn = isHttps ? xmlrpc.createSecureClient : xmlrpc.createClient;
  return createFn({
    host: url.hostname,
    port: isHttps ? 443 : parseInt(url.port || '80'),
    path,
  });
}

function xmlrpcCall(client: xmlrpc.Client, method: string, params: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function authenticate(): Promise<number> {
  const client = createClient('/xmlrpc/2/common');
  const uid = await xmlrpcCall(client, 'authenticate', [ODOO_DB, ODOO_USER, ODOO_PASS, {}]);
  if (!uid) throw new Error('Odoo: falló la autenticación. Verifica las credenciales.');
  return uid as number;
}

async function callOdoo(model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}): Promise<unknown> {
  const uid = await authenticate();
  const client = createClient('/xmlrpc/2/object');
  return xmlrpcCall(client, 'execute_kw', [ODOO_DB, uid, ODOO_PASS, model, method, args, kwargs]);
}

function cleanProductName(name: string): string {
  return name.replace(/\s*\(Alquiler\)\s*del\s+\d{2}\/\d{2}\/\d{4}.*/i, '')
             .replace(/\s*del\s+\d{2}\/\d{2}\/\d{4}.*/i, '')
             .replace(/\s+del\s+\d{4}-\d{2}-\d{2}.*/i, '')
             .replace(/\s*\(Alquiler\)\s*$/i, '')
             .replace(/\s+/g, ' ')
             .trim();
}

function parseProductCode(lineStr: string): { code: string; name: string } {
  // Odoo line descriptions can be multiline — use only the first line for code extraction
  const firstLine = lineStr?.split('\n')[0]?.trim() ?? '';
  const match = firstLine.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) return { code: match[1].trim(), name: cleanProductName(match[2].trim()) };
  return { code: '', name: cleanProductName(firstLine) };
}

export interface OdooOrderLine {
  odooLineId: number;
  productCode: string;
  productName: string;
  quantity: number;
}

export interface OdooOrder {
  odooOrderId: string;
  clientName: string;
  clientEmail: string | null;
  lines: OdooOrderLine[];
  rawData: unknown;
}

export async function fetchOdooOrder(orderName: string): Promise<OdooOrder> {
  const trimmed = orderName.trim().toUpperCase();

  const orderIds = await callOdoo('sale.order', 'search', [[['name', '=', trimmed]]], { limit: 1 }) as number[];
  if (!orderIds || orderIds.length === 0) {
    throw new Error(`No se encontró la orden "${trimmed}" en Odoo. Verifica el número de orden.`);
  }

  const orderRecords = await callOdoo('sale.order', 'read', [orderIds], {
    fields: ['name', 'partner_id', 'order_line'],
  }) as Record<string, unknown>[];

  const order = orderRecords[0];
  const lineIds = order['order_line'] as number[];

  // Get partner email from res.partner
  const partnerId = (order.partner_id as [number, string])[0];
  const partners = await callOdoo('res.partner', 'read', [[partnerId]], {
    fields: ['email'],
  }) as Record<string, unknown>[];
  const partnerEmail = (partners[0]?.email as string) || null;

  if (!lineIds || lineIds.length === 0) {
    return {
      odooOrderId: order.name as string,
      clientName: (order.partner_id as [number, string])[1],
      clientEmail: partnerEmail,
      lines: [],
      rawData: order,
    };
  }

  const lines = await callOdoo('sale.order.line', 'read', [lineIds], {
    fields: ['id', 'product_id', 'name', 'product_uom_qty'],
  }) as Record<string, unknown>[];

  const parsedLines: OdooOrderLine[] = lines
    .filter(line => line.product_id !== false)
    .map(line => {
      const name = line.name as string;
      const { code, name: parsedName } = parseProductCode(name);
      const productIdTuple = line.product_id as [number, string] | false;
      const productDisplayName = productIdTuple ? (productIdTuple[1] as string) : '';
      const { code: fallbackCode, name: fallbackName } = parseProductCode(productDisplayName);
      return {
        odooLineId: line.id as number,
        productCode: fallbackCode || code || productDisplayName,
        productName: parsedName || fallbackName || cleanProductName(productDisplayName) || name,
        quantity: Math.round((line.product_uom_qty as number) || 1),
      };
    });

  return {
    odooOrderId: order.name as string,
    clientName: (order.partner_id as [number, string])[1],
    clientEmail: partnerEmail,
    lines: parsedLines,
    rawData: order,
  };
}
