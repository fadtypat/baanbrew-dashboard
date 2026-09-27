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

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

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
