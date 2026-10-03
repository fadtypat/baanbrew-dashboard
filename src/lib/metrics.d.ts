// Type declarations สำหรับ metrics.js (ให้ใช้จาก .tsx ได้แบบมี type)

export interface SaleRow {
  order_id: string
  datetime: string
  date: string
  branch: string
  product_id: string
  qty: number
  unit_price: number
  customer_id: string | null
  payment_method: string
  channel: string
}

export interface Kpis {
  totalSales: number
  orderCount: number
  averageOrderValue: number
  uniqueMembers: number
}

export interface PreparedRow extends SaleRow {
  revenue: number
  hour: number
}

export function parseSales(csvText: string): SaleRow[]
export function prepareRows(rows: SaleRow[]): PreparedRow[]
export function dailyRevenue(rows: PreparedRow[]): { date: string; revenue: number }[]
export function fmtBaht(n: number): string
export function fmtNum(n: number): string
export function fmtShortBaht(n: number): string
export function lineTotal(row: SaleRow): number
export function totalSales(rows: SaleRow[]): number
export function orderCount(rows: SaleRow[]): number
export function averageOrderValue(rows: SaleRow[]): number
export function uniqueMemberCount(rows: SaleRow[]): number
export function dailySales(rows: SaleRow[]): { date: string; sales: number }[]
export interface MonthlySales {
  month: string
  sales: number
  orders: number
  days: number
  perDay: number
  partial: boolean
}
export function monthlySales(rows: SaleRow[], period: { from: string; to: string }): MonthlySales[]
export function withMovingAverage(
  daily: { date: string; sales: number }[],
  windowDays?: number,
): { date: string; sales: number; avg: number | null }[]
export function salesByBranch(rows: SaleRow[]): { branch: string; sales: number; share: number }[]
export function salesByPaymentMethod(rows: SaleRow[]): { method: string; sales: number; share: number }[]
export function salesByProduct(rows: SaleRow[]): { product_id: string; sales: number; qty: number; share: number }[]
export function kpis(rows: SaleRow[]): Kpis
export function formatNumber(n: number): string
export function formatBaht(n: number): string
export function formatPercent(n: number): string
export function formatBahtCompact(n: number): string
export function formatThaiDate(isoDate: string, opts?: { year?: 'full' | 'short' | 'none' }): string
