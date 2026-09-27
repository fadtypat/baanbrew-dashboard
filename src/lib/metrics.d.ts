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

export function parseSales(csvText: string): SaleRow[]
export function lineTotal(row: SaleRow): number
export function totalSales(rows: SaleRow[]): number
export function orderCount(rows: SaleRow[]): number
export function averageOrderValue(rows: SaleRow[]): number
export function uniqueMemberCount(rows: SaleRow[]): number
export function dailySales(rows: SaleRow[]): { date: string; sales: number }[]
export function withMovingAverage(
  daily: { date: string; sales: number }[],
  windowDays?: number,
): { date: string; sales: number; avg: number | null }[]
export function salesByBranch(rows: SaleRow[]): { branch: string; sales: number }[]
export function kpis(rows: SaleRow[]): Kpis
export function formatNumber(n: number): string
export function formatBaht(n: number): string
export function formatBahtCompact(n: number): string
export function formatThaiDate(isoDate: string, opts?: { year?: 'full' | 'short' | 'none' }): string
