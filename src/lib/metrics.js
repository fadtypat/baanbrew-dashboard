// Logic คำนวณทั้งหมดของ Dashboard — ไม่มีโค้ด UI ในไฟล์นี้
import Papa from 'papaparse'

/**
 * แปลงข้อความ CSV เป็น array ของแถว พร้อมแปลงชนิดข้อมูล
 * - qty, unit_price → number
 * - customer_id ว่าง → null (ลูกค้าทั่วไป)
 * - เพิ่ม date = 'YYYY-MM-DD' ตัดจาก datetime ตรง ๆ เพื่อคงวันที่ตามเวลาไทย
 *   (ไม่ผ่าน new Date() ซึ่งจะแปลงเป็น timezone ของเครื่องผู้ดู)
 */
export function parseSales(csvText) {
  const { data } = Papa.parse(csvText.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return data.map((r) => ({
    order_id: r.order_id,
    datetime: r.datetime,
    date: r.datetime.slice(0, 10),
    branch: r.branch,
    product_id: r.product_id,
    qty: Number(r.qty),
    unit_price: Number(r.unit_price),
    customer_id: r.customer_id?.trim() || null,
    payment_method: r.payment_method,
    channel: r.channel,
  }))
}

/**
 * เตรียมแถวสำหรับหน้า Lab 2.2 (src/lab2): รับแถวจาก parseSales() แล้วเพิ่ม
 * - revenue = qty × unit_price
 * - hour    = ชั่วโมงตามเวลาไทย ตัดจาก datetime ตรง ๆ
 */
export function prepareRows(rows) {
  return rows.map((r) => ({ ...r, revenue: lineTotal(r), hour: Number(r.datetime.slice(11, 13)) }))
}

/** ยอดขายของ 1 แถว = qty × unit_price */
export function lineTotal(row) {
  return row.qty * row.unit_price
}

/** ยอดขายรวม = ผลรวม lineTotal ของทุกแถว */
export function totalSales(rows) {
  return rows.reduce((sum, r) => sum + lineTotal(r), 0)
}

/** จำนวนบิล = จำนวน order_id ที่ไม่ซ้ำ (บิลหนึ่งมีได้หลายแถว จึงนับแถวตรง ๆ ไม่ได้) */
export function orderCount(rows) {
  return new Set(rows.map((r) => r.order_id)).size
}

/** ยอดเฉลี่ยต่อบิล = ยอดขายรวม ÷ จำนวนบิล (ถ้าไม่มีบิลคืน 0) */
export function averageOrderValue(rows) {
  const orders = orderCount(rows)
  return orders === 0 ? 0 : totalSales(rows) / orders
}

/** ลูกค้าสมาชิกที่ไม่ซ้ำ = จำนวน customer_id ที่ไม่ว่างและไม่ซ้ำ */
export function uniqueMemberCount(rows) {
  return new Set(rows.filter((r) => r.customer_id).map((r) => r.customer_id)).size
}

/** รวม lineTotal ตาม key ที่กำหนด → Map<key, ยอดขาย> */
function sumBy(rows, keyFn) {
  const map = new Map()
  for (const r of rows) {
    const k = keyFn(r)
    map.set(k, (map.get(k) ?? 0) + lineTotal(r))
  }
  return map
}

/** ยอดขายรายวัน: group ตาม date (วันที่ไทย) แล้วเรียงวันที่จากเก่าไปใหม่ → [{ date, sales }] */
export function dailySales(rows) {
  return [...sumBy(rows, (r) => r.date)]
    .map(([date, sales]) => ({ date, sales }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * ยอดขายรายเดือน → [{ month, sales, orders, days, perDay, partial }] เรียงจากเก่าไปใหม่
 * - month   = 'YYYY-MM' (ตัดจาก date ตามเวลาไทย)
 * - orders  = จำนวนบิลไม่ซ้ำในเดือนนั้น
 * - days    = จำนวนวันปฏิทินของเดือนที่อยู่ในช่วง period (ใช้หาค่าเฉลี่ยต่อวัน)
 * - perDay  = sales ÷ days ใช้เทียบเดือนที่ไม่ครบเดือนกับเดือนอื่นได้ยุติธรรมกว่า
 * - partial = true เมื่อ period ไม่ครอบคลุมทั้งเดือน (เช่น ข้อมูลถึงแค่ 20 ก.ย.)
 * period = { from, to } ช่วงวันที่ที่ข้อมูลครอบคลุมจริง ('YYYY-MM-DD')
 */
export function monthlySales(rows, period) {
  const map = new Map()
  for (const r of rows) {
    const month = r.date.slice(0, 7)
    const m = map.get(month) ?? { sales: 0, orders: new Set() }
    m.sales += lineTotal(r)
    m.orders.add(r.order_id)
    map.set(month, m)
  }
  return [...map]
    .map(([month, m]) => {
      const first = `${month}-01`
      const last = dateFromDayNumber(dayNumber(nextMonthFirstDay(month)) - 1)
      const from = period.from > first ? period.from : first
      const to = period.to < last ? period.to : last
      const days = Math.max(1, dayNumber(to) - dayNumber(from) + 1)
      return { month, sales: m.sales, orders: m.orders.size, days, perDay: m.sales / days, partial: from !== first || to !== last }
    })
    .sort((a, b) => a.month.localeCompare(b.month))
}

/** 'YYYY-MM' → 'YYYY-MM-DD' ของวันที่ 1 เดือนถัดไป */
function nextMonthFirstDay(month) {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

/**
 * ค่าเฉลี่ยเคลื่อนที่ย้อนหลัง N วัน (ค่าเริ่มต้น 7) ของยอดขายรายวัน → [{ date, sales, avg }]
 * - avg ของวัน d = ผลรวมยอดขาย d-(N-1) ถึง d ÷ N
 * - นับตามวันปฏิทิน: วันที่ไม่มีข้อมูลในช่วงถือเป็นยอด 0
 * - N-1 วันแรกยังมีข้อมูลไม่ครบหน้าต่าง จึงให้ avg = null (กราฟจะไม่วาดช่วงนั้น)
 */
export function withMovingAverage(daily, windowDays = 7) {
  const salesByDate = new Map(daily.map((d) => [d.date, d.sales]))
  const first = daily.length ? dayNumber(daily[0].date) : 0
  return daily.map((d) => {
    const today = dayNumber(d.date)
    if (today - first < windowDays - 1) return { ...d, avg: null }
    let sum = 0
    for (let i = 0; i < windowDays; i++) sum += salesByDate.get(dateFromDayNumber(today - i)) ?? 0
    return { ...d, avg: sum / windowDays }
  })
}

// 'YYYY-MM-DD' ↔ เลขลำดับวัน (คิดแบบ UTC เพื่อไม่ให้ timezone ของเครื่องมีผล)
function dayNumber(isoDate) {
  return Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000
}
function dateFromDayNumber(n) {
  return new Date(n * 86_400_000).toISOString().slice(0, 10)
}

/**
 * ยอดขายแยกสาขา: group ตาม branch แล้วเรียงยอดขายจากมากไปน้อย → [{ branch, sales, share }]
 * share = ยอดขายสาขา ÷ ยอดขายรวม (0–1)
 */
export function salesByBranch(rows) {
  const total = totalSales(rows)
  return [...sumBy(rows, (r) => r.branch)]
    .map(([branch, sales]) => ({ branch, sales, share: total === 0 ? 0 : sales / total }))
    .sort((a, b) => b.sales - a.sales)
}

/**
 * สัดส่วนยอดขายตามวิธีชำระเงิน → [{ method, sales, share }] เรียงมากไปน้อย
 * - sales = ผลรวม lineTotal ของแถวที่ใช้วิธีชำระนั้น
 * - share = sales ÷ ยอดขายรวม (0–1)
 * หมายเหตุ: บิลเดียวอาจมีหลายวิธีชำระ จึงคิดระดับแถว ไม่ใช่ระดับบิล
 */
export function salesByPaymentMethod(rows) {
  const total = totalSales(rows)
  return [...sumBy(rows, (r) => r.payment_method)]
    .map(([method, sales]) => ({ method, sales, share: total === 0 ? 0 : sales / total }))
    .sort((a, b) => b.sales - a.sales)
}

/**
 * ยอดขายแยกตามเมนู → [{ product_id, sales, qty, share }] เรียงยอดขายจากมากไปน้อย
 * - qty   = จำนวนชิ้น/แก้วที่ขายได้ (ผลรวม qty)
 * - share = ยอดขายเมนู ÷ ยอดขายรวม (0–1)
 */
export function salesByProduct(rows) {
  const total = totalSales(rows)
  const map = new Map()
  for (const r of rows) {
    const p = map.get(r.product_id) ?? { product_id: r.product_id, sales: 0, qty: 0 }
    p.sales += lineTotal(r)
    p.qty += r.qty
    map.set(r.product_id, p)
  }
  return [...map.values()]
    .map((p) => ({ ...p, share: total === 0 ? 0 : p.sales / total }))
    .sort((a, b) => b.sales - a.sales)
}

/** สรุป KPI ทั้ง 4 ตัวในครั้งเดียว */
export function kpis(rows) {
  return {
    totalSales: totalSales(rows),
    orderCount: orderCount(rows),
    averageOrderValue: averageOrderValue(rows),
    uniqueMembers: uniqueMemberCount(rows),
  }
}

const numberFmt = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 })
const bahtFmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const percentFmt = new Intl.NumberFormat('th-TH', { style: 'percent', maximumFractionDigits: 0 })
const compactFmt = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 })

/** ตัวเลขมีจุลภาค เช่น 12,345 */
export function formatNumber(n) {
  return numberFmt.format(n)
}

/** จำนวนเงิน เช่น ฿12,345.50 */
export function formatBaht(n) {
  return `฿${bahtFmt.format(n)}`
}

/** สัดส่วน 0–1 → เปอร์เซ็นต์ เช่น 0.48 → 48% */
export function formatPercent(n) {
  return percentFmt.format(n)
}

/** จำนวนเงินแบบย่อสำหรับแกนกราฟ เช่น ฿12K */
export function formatBahtCompact(n) {
  return `฿${compactFmt.format(n)}`
}

/* ---------- สำหรับ src/lab2 (ใช้ชื่อเดียวกับ lab2-starter) ---------- */

/** ยอดขายรายวันจากแถวที่ผ่าน prepareRows() → [{ date, revenue }] */
export function dailyRevenue(rows) {
  return dailySales(rows).map(({ date, sales }) => ({ date, revenue: sales }))
}

/** KPI 4 ตัวในชื่อแบบ lab3-starter → { revenue, bills, avgPerBill, customers } */
export function computeKpis(rows) {
  const k = kpis(rows)
  return { revenue: k.totalSales, bills: k.orderCount, avgPerBill: k.averageOrderValue, customers: k.uniqueMembers }
}

/** ยอดขายแยกสาขา เรียงมากไปน้อย → [{ branch, revenue, bills }] */
export function revenueByBranch(rows) {
  return salesByBranch(rows).map(({ branch, sales }) => ({
    branch,
    revenue: sales,
    bills: orderCount(rows.filter((r) => r.branch === branch)),
  }))
}

/** จำนวนเงินไม่มีทศนิยม เช่น ฿12,346 */
export const fmtBaht = (n) => `฿${numberFmt.format(n)}`
/** ตัวเลขมีจุลภาค */
export const fmtNum = formatNumber
/** จำนวนเงินแบบย่อบนแกนกราฟ เช่น ฿1.2 ล., ฿85k */
export const fmtShortBaht = (n) =>
  n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)} ล.` : n >= 1000 ? `฿${(n / 1000).toFixed(0)}k` : `฿${n}`

const THAI_MONTHS =['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/**
 * 'YYYY-MM-DD' → วันที่ไทยแบบ พ.ศ. (ปี ค.ศ. + 543)
 * - year: 'full'  → '1 เม.ย. 2568'
 * - year: 'short' → '1 เม.ย. 68'  (2 หลักท้ายของ พ.ศ. ใช้บนแกนกราฟ)
 * - year: 'none'  → '1 เม.ย.'
 * แยก string ตรง ๆ ไม่ผ่าน Date จึงไม่เพี้ยนตาม timezone
 */
export function formatThaiDate(isoDate, { year = 'full' } = {}) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const be = y + 543
  const yearText = year === 'full' ? ` ${be}` : year === 'short' ? ` ${String(be).slice(-2)}` : ''
  return `${d} ${THAI_MONTHS[m - 1]}${yearText}`
}
