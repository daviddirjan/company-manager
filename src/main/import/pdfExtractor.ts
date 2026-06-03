import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

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
  if (/\bCHF\b/.test(text)) return 'CHF';
  if (/\bPLN\b/.test(text)) return 'PLN';
  if (/\bEUR\b/.test(text)) return 'EUR';
  if (/\bRON\b/.test(text)) return 'RON';
  if (/\bUSD\b/.test(text)) return 'USD';
  return 'RON';
}

function extractInvoiceNumber(text: string): { series: string; number: string } | null {
  const patterns = [
    /[Ss]eri[ae][sa]?\s+([A-Z]+)\s+Nr\.?\s*(\d+)/,   // Romanian
    /[Ss]eri[ae][sa]?\s+([A-Z]+)\s+nro\s+(\d+)/,      // Spanish
    /[Ss]eri[ae][sa]?\s+([A-Z]+)\s+no\.?\s*(\d+)/,    // English/French
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
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer, { max: 1 });
    const text: string = data.text;

    const isChitanta = /CHITAN[TȚ]A/i.test(text.slice(0, 200));
    const lang = detectLanguage(text);
    const currency = detectCurrency(text);
    const numInfo = extractInvoiceNumber(text);

    if (!numInfo) return null;

    const { issue, due } = extractDates(text);
    if (!issue) return null;

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
  } catch {
    return null;
  }
}
