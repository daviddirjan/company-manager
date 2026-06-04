import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse');

export interface ExtractedInvoice {
  series_name: string;
  number: string;
  issue_date: string;
  due_date: string | null;
  client_name: string;
  client_vat_code: string | null;
  client_country: string | null;
  total_amount: number;
  currency: string;
  language: string;
  pdf_filename: string;
  pdf_path: string;
  is_chitanta: boolean;
}

function parseDate(raw: string): string {
  // Input: DD/MM/YYYY → output: YYYY-MM-DD
  const [d, m, y] = raw.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function detectLanguage(text: string): string {
  if (/FACTUR[AĂ]\b/i.test(text.slice(0, 100))) return 'ro';
  if (/FACTURE\b/i.test(text.slice(0, 100))) return 'fr';
  if (/\bINVOICE\b/i.test(text.slice(0, 100))) return 'en';
  if (/\bFACTURA\b/i.test(text.slice(0, 100))) {
    if (/\bPROVEEDOR\b|\bFECHA\b|\bnro\b/i.test(text)) return 'es';
    return 'ro';
  }
  return 'ro';
}

function detectCurrency(text: string): string {
  // Most reliable: currency appears as a standalone line in the product table column header
  const standalone = text.match(/^(EUR|CHF|PLN|USD|RON)$/m);
  if (standalone) return standalone[1];
  // Fallback: word search after stripping IBAN lines (both EUR and RON IBANs appear in every invoice)
  const cleaned = text.replace(/IBAN[^\n]*/gi, '');
  if (/\bCHF\b/.test(cleaned)) return 'CHF';
  if (/\bPLN\b/.test(cleaned)) return 'PLN';
  if (/\bEUR\b/.test(cleaned)) return 'EUR';
  if (/\bRON\b|\bLei\b/.test(cleaned)) return 'RON';
  if (/\bUSD\b/.test(cleaned)) return 'USD';
  return 'RON';
}

function extractInvoiceNumber(text: string): { series: string; number: string } | null {
  const patterns = [
    /[Ss]eri[ae][sa]?:?\s+([A-Z]+)\s+[Nn]r\.?:?\s*(\d+)/,   // Romanian (with/without colons)
    /[Ss]eri[ae][sa]?:?\s+([A-Z]+)\s+nro\.?:?\s*(\d+)/,      // Spanish
    /[Ss]eri[ae][sa]?:?\s+([A-Z]+)\s+[Nn]o\.?:?\s*(\d+)/,    // English/French
    /\bInvoice\s+[Nn]o\.?:?\s*([A-Z]+)[- ]?(\d+)/,           // "Invoice No: AX-123"
    /\b([A-Z]{2,6})\s*[-/]\s*(\d{3,})\b/,                     // "AX-0123" or "AX/0123"
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return { series: m[1], number: m[2].padStart(3, '0') };
  }
  return null;
}

function extractDates(text: string): { issue: string | null; due: string | null } {
  const dateRe = /\d{2}\/\d{2}\/\d{4}/g;
  const dates = text.match(dateRe) ?? [];

  const issuePat = /(?:din|del|dated|du)\s+(\d{2}\/\d{2}\/\d{4})/i;
  const duePat = /(?:Termen\s*plata|Fecha\s*de\s*pago|Payment\s*term|Terme\s*de\s*payement)\s+(\d{2}\/\d{2}\/\d{4})/i;

  const issueMatch = text.match(issuePat);
  const dueMatch = text.match(duePat);

  const issue = issueMatch ? parseDate(issueMatch[1]) : (dates[0] ? parseDate(dates[0]) : null);
  const due = dueMatch ? parseDate(dueMatch[1]) : (dates[1] ? parseDate(dates[1]) : null);

  return { issue, due };
}

function extractClientName(text: string, lang: string): string {
  // Find the client section header, then take the next non-empty line
  const clientHeaders: Record<string, string> = {
    ro: 'CLIENT',
    es: 'CLIENTE',
    en: 'CUSTOMER',
    fr: 'CLIENT',
  };
  const header = clientHeaders[lang] ?? 'CLIENT';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(l => l.startsWith(header));
  if (headerIdx !== -1) {
    // The client name is usually the line right after the header block
    // Skip lines that are vendor info (AXIONTIC) or known labels
    for (let i = headerIdx + 1; i < Math.min(headerIdx + 6, lines.length); i++) {
      const line = lines[i];
      if (
        line.startsWith('CIF') || line.startsWith('VAT') ||
        line.startsWith('Reg') || line.startsWith('No.') ||
        line.startsWith('Adresa') || line.startsWith('Address') ||
        line.startsWith('Dirección') || line.startsWith('Adresse') ||
        line.startsWith('Judet') || line.startsWith('Tara') ||
        line.startsWith('IBAN') || line.startsWith('Banca') ||
        line.length < 3
      ) continue;
      // Skip if it's repeating header labels
      if (['FURNIZOR', 'PROVEEDOR', 'FOURNISSEUR', 'VENDOR', 'CLIENT', 'CLIENTE', 'CUSTOMER'].includes(line.toUpperCase())) continue;
      return line;
    }
  }
  return 'Unknown';
}

function extractClientVat(text: string, lang: string): string | null {
  // After extracting client section, look for CIF/VAT pattern
  const vatPat = lang === 'es'
    ? /CLIENTE[\s\S]{0,300}?CIF:\s*([A-Z0-9]+)/i
    : lang === 'en'
    ? /CUSTOMER[\s\S]{0,300}?VAT\s*CODE[^:]*:\s*([A-Z0-9]+)/i
    : lang === 'fr'
    ? /CLIENT[\s\S]{0,300}?CODE\s*TVA[^:]*:\s*([A-Z0-9]+)/i
    : /CLIENT[\s\S]{0,300}?CIF:\s*([A-Z0-9]+)/i;

  const m = text.match(vatPat);
  return m ? m[1] : null;
}

function extractTotalAmount(text: string): number {
  // Look for TOTAL line — last number on a line containing TOTAL
  const lines = text.split('\n');
  let lastTotal = 0;

  for (const line of lines) {
    if (/TOTAL/i.test(line)) {
      // Find the last number (possibly with spaces as thousand separators)
      const nums = line.match(/[\d\s]+[.,]\d{2}/g);
      if (nums) {
        const raw = nums[nums.length - 1].replace(/\s/g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val) && val > 0) lastTotal = val;
      }
    }
  }

  if (lastTotal > 0) return lastTotal;

  // Fallback: last monetary value in the document
  const allNums = text.match(/\b\d[\d\s]*[.,]\d{2}\b/g) ?? [];
  for (let i = allNums.length - 1; i >= 0; i--) {
    const val = parseFloat(allNums[i].replace(/\s/g, '').replace(',', '.'));
    if (!isNaN(val) && val > 0 && val < 1_000_000) return val;
  }

  return 0;
}

function detectClientCountry(text: string): string | null {
  if (/Tara:\s*Romania/i.test(text) || /Romania/i.test(text)) return 'RO';
  if (/CIF:\s*B\d/i.test(text) || /Spain|España/i.test(text)) return 'ES';
  if (/CHE\d/i.test(text) || /Switzerland/i.test(text)) return 'CH';
  if (/\b\d{10}\b[\s\S]{0,30}Poland|Zakład|Ślusarsko/i.test(text)) return 'PL';
  if (/SARL|France/i.test(text)) return 'FR';
  return null;
}

export async function extractFromPdf(filePath: string): Promise<ExtractedInvoice | null> {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const data = await parser.getText();
  const text: string = data.text;

  const isChitanta = /CHITAN[TȚ]A/i.test(text.slice(0, 200));
  const lang = detectLanguage(text);
  const currency = detectCurrency(text);

  let numInfo = extractInvoiceNumber(text);
  if (!numInfo) {
    // Fallback: derive series/number from filename (e.g. AX123.pdf → AX / 123)
    const fnMatch = path.basename(filePath, '.pdf').match(/^([A-Za-z]+)(\d+)$/);
    if (fnMatch) numInfo = { series: fnMatch[1].toUpperCase(), number: fnMatch[2].padStart(3, '0') };
  }

  if (!numInfo) throw new Error(`Invoice number not found in PDF text (lang: ${lang})`);

  const { issue, due } = extractDates(text);
  if (!issue) throw new Error(`Issue date not found in PDF text`);

  const clientName = extractClientName(text, lang);
  const clientVat = extractClientVat(text, lang);
  const clientCountry = detectClientCountry(text);
  const total = extractTotalAmount(text);
  const filename = path.basename(filePath);

  return {
    series_name: numInfo.series,
    number: numInfo.number,
    issue_date: issue,
    due_date: due,
    client_name: clientName,
    client_vat_code: clientVat,
    client_country: clientCountry,
    total_amount: total,
    currency,
    language: lang,
    pdf_filename: filename,
    pdf_path: filePath,
    is_chitanta: isChitanta,
  };
}
