export interface SmartBillConfig {
  username: string;
  token: string;
  cif: string;
  seriesName: string;
}

export interface PaymentStatusResponse {
  invoiceTotalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  paid: boolean;
  errorMessage?: string;
}
