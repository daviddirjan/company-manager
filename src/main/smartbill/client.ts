import axios, { type AxiosInstance } from 'axios';
import type { SmartBillConfig, PaymentStatusResponse } from './types';

const BASE_URL = 'https://ws.smartbill.ro/SBORO/api';
const MIN_INTERVAL_MS = 350; // conservative for 3 req/sec limit

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class SmartBillClient {
  private http: AxiosInstance;
  private cif: string;
  private seriesName: string;
  private lastCallAt = 0;

  constructor(config: SmartBillConfig) {
    const token = Buffer.from(`${config.username}:${config.token}`).toString('base64');
    this.cif = config.cif;
    this.seriesName = config.seriesName || 'AX';
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Basic ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - elapsed);
    }
    this.lastCallAt = Date.now();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.throttle();
      await this.http.get('/series', { params: { cif: this.cif, type: 'f' } });
      return true;
    } catch {
      return false;
    }
  }

  async getPaymentStatus(invoiceNumber: string): Promise<PaymentStatusResponse | null> {
    try {
      await this.throttle();
      const res = await this.http.get('/invoice/paymentstatus', {
        params: { cif: this.cif, seriesname: this.seriesName, number: invoiceNumber },
      });
      return res.data as PaymentStatusResponse;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      throw err;
    }
  }
}
