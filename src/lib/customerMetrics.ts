// Logic ของแท็บ "ข้อมูลลูกค้า" — สรุปสมาชิกจาก customers.csv เทียบกับ sales / branches (ไม่มีโค้ด UI)
import Papa from 'papaparse'
import { lineTotal, type SaleRow } from './metrics.js'

export type Customer = {
  customer_id: string
  nickname: string
  gender: string
  age_group: string
  home_branch_id: string
  joined_date: string
  phone: string
}
export type Branch = { branch_id: string; branch: string; branch_type: string; opened_date: string }

export const GENDERS = ['หญิง', 'ชาย', 'ไม่ระบุ'] as const
export const AGE_GROUPS = ['ต่ำกว่า 18', '18-24', '25-34', '35-44', '45-54', '55+'] as const
/** อ่าน CSV ทุกคอลัมน์เป็นข้อความ (ตัด BOM และช่องว่างในหัวคอลัมน์) */
export function parseCsv<T>(text: string): T[] {
  const { data } = Papa.parse<T>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return data
}

function countBy<T>(items: T[], key: (t: T) => string) {
  const map = new Map<string, number>()
  for (const t of items) map.set(key(t), (map.get(key(t)) ?? 0) + 1)
  return map
}

function mode(map: Map<string, number>) {
  let best = ''
  let max = -1
  for (const [k, v] of map) if (v > max) [best, max] = [k, v]
  return best
}

/** สรุปการซื้อของสมาชิกแต่ละคนจาก sales: วันแรกที่ซื้อ, จำนวนบิล, ยอดซื้อ, สาขาที่ซื้อบ่อยสุด */
function purchasesByCustomer(rows: SaleRow[]) {
  const acc = new Map<string, { first: string; orders: Set<string>; spend: number; branches: Map<string, number> }>()
  for (const r of rows) {
    if (!r.customer_id) continue
    let a = acc.get(r.customer_id)
    if (!a) acc.set(r.customer_id, (a = { first: r.date, orders: new Set(), spend: 0, branches: new Map() }))
    if (r.date < a.first) a.first = r.date
    a.orders.add(r.order_id)
    a.spend += lineTotal(r)
    a.branches.set(r.branch, (a.branches.get(r.branch) ?? 0) + 1)
  }
  return new Map(
    [...acc].map(([id, a]) => [id, { first: a.first, bills: a.orders.size, spend: a.spend, topBranch: mode(a.branches) }]),
  )
}

/** ช่วงวันที่ 'YYYY-MM-DD' ทั้งสองฝั่งรวมวันนั้นด้วย */
export type DateRange = { from: string; to: string }

/** ช่วงวันที่ที่มีข้อมูล: ตั้งแต่วันแรกที่มีคนสมัคร/ซื้อ ถึงวันสุดท้ายที่มีคนสมัคร/ซื้อ */
export function dataBounds(customers: Customer[], rows: SaleRow[]): DateRange {
  let from = '9999-12-31'
  let to = ''
  for (const d of [...customers.map((c) => c.joined_date), ...rows.map((r) => r.date)]) {
    if (d < from) from = d
    if (d > to) to = d
  }
  return { from, to }
}

/** 'YYYY-MM-DD' ของวันสุดท้ายของเดือน 'YYYY-MM' */
function monthEnd(month: string) {
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()
  return `${month}-${String(last).padStart(2, '0')}`
}

/**
 * สรุปข้อมูลลูกค้าในช่วงวันที่ที่เลือก
 * - สมาชิก = คนที่สมัคร (joined_date) อยู่ในช่วง
 * - การซื้อ / ยอดขาย = แถวใน sales ที่วันที่อยู่ในช่วง
 * ดังนั้น "เคยซื้อแล้ว" = สมาชิกที่สมัครในช่วงนี้ และซื้ออย่างน้อย 1 ครั้งภายในช่วงเดียวกัน
 */
export function customerReport(allCustomers: Customer[], branches: Branch[], allRows: SaleRow[], range: DateRange) {
  const inRange = (d: string) => d >= range.from && d <= range.to
  const customers = allCustomers.filter((c) => inRange(c.joined_date))
  const rows = allRows.filter((r) => inRange(r.date))
  const n = customers.length
  const buys = purchasesByCustomer(rows)

  const active = customers.filter((c) => buys.has(c.customer_id))
  const neverBought = n - active.length

  // สมัครรายเดือน แยกคนที่ซื้อแล้ว / ยังไม่เคยซื้อ
  const months = new Map<string, { month: string; bought: number; never: number }>()
  for (const c of customers) {
    const m = c.joined_date.slice(0, 7)
    const row = months.get(m) ?? { month: m, bought: 0, never: 0 }
    if (buys.has(c.customer_id)) row.bought++
    else row.never++
    months.set(m, row)
  }
  const monthly = [...months.values()].sort((a, b) => a.month.localeCompare(b.month))

  // เดือนที่ไม่ครบเดือน: เดือนแรกถ้าช่วงไม่ได้เริ่มวันที่ 1 / เดือนท้ายถ้าช่วง (หรือข้อมูลสมัคร) จบก่อนสิ้นเดือน
  const lastJoinInData = allCustomers.reduce((m, c) => (c.joined_date > m ? c.joined_date : m), '')
  const effectiveEnd = range.to < lastJoinInData ? range.to : lastJoinInData
  const partialMonths = monthly
    .map((m) => m.month)
    .filter((m) => range.from > `${m}-01` || effectiveEnd < monthEnd(m))

  // สัดส่วนของคนที่ยังไม่เคยซื้อ ที่สมัครใน 3 เดือนท้ายของช่วง
  const recentMonths = new Set(monthly.slice(-3).map((m) => m.month))
  const neverRecentShare = neverBought
    ? monthly.filter((m) => recentMonths.has(m.month)).reduce((s, m) => s + m.never, 0) / neverBought
    : 0

  const share = (x: number) => (n ? x / n : 0)
  const genderCount = countBy(customers, (c) => c.gender)
  const gender = GENDERS.map((g) => ({ gender: g, count: genderCount.get(g) ?? 0, share: share(genderCount.get(g) ?? 0) }))
  const ageCount = countBy(customers, (c) => c.age_group)
  const age = AGE_GROUPS.map((a) => ({ age: a, count: ageCount.get(a) ?? 0, share: share(ageCount.get(a) ?? 0) }))

  // สมาชิกตามสาขาประจำ
  const byBranch = branches
    .map((b) => {
      const members = customers.filter((c) => c.home_branch_id === b.branch_id)
      const act = members.filter((c) => buys.has(c.customer_id))
      const sameBranch = act.filter((c) => buys.get(c.customer_id)!.topBranch === b.branch).length
      const spend = act.reduce((s, c) => s + buys.get(c.customer_id)!.spend, 0)
      return {
        branch: b.branch,
        opened: b.opened_date,
        members: members.length,
        activeShare: members.length ? act.length / members.length : 0,
        loyalShare: act.length ? sameBranch / act.length : 0,
        spendPerActive: act.length ? spend / act.length : 0,
      }
    })
    .sort((a, b) => b.members - a.members)

  // สมาชิก vs ลูกค้าทั่วไป ในช่วงนี้ (ระดับบิล: บิลที่มี customer_id ถือเป็นบิลสมาชิก)
  const orders = new Map<string, { member: boolean; total: number }>()
  for (const r of rows) {
    const o = orders.get(r.order_id) ?? { member: false, total: 0 }
    o.member ||= Boolean(r.customer_id)
    o.total += lineTotal(r)
    orders.set(r.order_id, o)
  }
  const split = (member: boolean) => {
    const list = [...orders.values()].filter((o) => o.member === member)
    const sales = list.reduce((s, o) => s + o.total, 0)
    return { bills: list.length, sales, aov: list.length ? sales / list.length : 0 }
  }
  const memberOrders = split(true)
  const walkinOrders = split(false)
  const totalSales = memberOrders.sales + walkinOrders.sales

  return {
    total: n,
    active: active.length,
    neverBought,
    neverRecentShare,
    partialMonths,
    monthly,
    gender,
    age,
    byBranch,
    memberOrders,
    walkinOrders,
    memberSalesShare: totalSales ? memberOrders.sales / totalSales : 0,
  }
}

export type CustomerReport = ReturnType<typeof customerReport>

/**
 * สัดส่วนการสมัครสมาชิกแต่ละเดือน เรียงจากน้อยไปมาก → [{ month, count, share }]
 * - นับเฉพาะสมาชิกที่สมัครในช่วงวันที่ และตรงกับเพศ / ช่วงอายุที่เลือก ('' = ทั้งหมด)
 * - share = จำนวนที่สมัครในเดือนนั้น ÷ จำนวนสมาชิกทั้งหมดที่ตรงเงื่อนไข (รวมทุกเดือนได้ 100%)
 * - เดือนที่ไม่มีคนสมัครเลย (แต่อยู่ในช่วง) แสดงเป็น 0 ด้วย
 */
export function joinShareByMonth(customers: Customer[], range: DateRange, gender = '', ageGroup = '') {
  const picked = customers.filter(
    (c) =>
      c.joined_date >= range.from &&
      c.joined_date <= range.to &&
      (!gender || c.gender === gender) &&
      (!ageGroup || c.age_group === ageGroup),
  )
  const counts = countBy(picked, (c) => c.joined_date.slice(0, 7))
  // ใส่ทุกเดือนในช่วงไว้ก่อน เพื่อให้เดือนที่เป็น 0 ไม่หายไปจากกราฟ
  for (let m = range.from.slice(0, 7); m <= range.to.slice(0, 7); ) {
    if (!counts.has(m)) counts.set(m, 0)
    const [y, mo] = m.split('-').map(Number)
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
  }
  const total = picked.length
  return {
    total,
    months: [...counts]
      .map(([month, count]) => ({ month, count, share: total ? count / total : 0 }))
      .sort((a, b) => a.count - b.count || a.month.localeCompare(b.month)),
  }
}
