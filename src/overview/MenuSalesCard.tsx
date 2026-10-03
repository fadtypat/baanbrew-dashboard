// การ์ด "ยอดขายแยกตามเมนู" ของหน้าภาพรวม: แท่งแนวนอนต่อเมนู สีตามหมวด + สรุปรายหมวด
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBaht, formatBahtCompact, formatNumber, formatPercent, salesByProduct, type SaleRow } from '../lib/metrics.js'
import { Card } from '../components/ui.tsx'
import { AMBER, AXIS_TICK, BLUE, GRID_COLOR, PINK, PURPLE, TEAL, TOOLTIP_STYLE, useIsMobile } from '../components/theme.ts'

export type Product = { product_id: string; product_name: string; category: string }

const TOP_N = 10
// สีประจำหมวด (ลำดับตาม products.csv) — หมวดที่ไม่รู้จักใช้สีเทา
const CATEGORY_COLORS = [PINK, PURPLE, BLUE, AMBER, TEAL, '#e8705a', '#7aa63a', '#9a93a8']
const UNKNOWN_COLOR = '#c4bccf'
const SELECT_CLASS = 'rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 focus:border-[#e0428f] focus:outline-none'

type Metric = 'sales' | 'qty'

export default function MenuSalesCard({ rows, products }: { rows: SaleRow[]; products: Product[] }) {
  const [metric, setMetric] = useState<Metric>('sales')
  const [category, setCategory] = useState('') // '' = ทุกหมวด
  const [showAll, setShowAll] = useState(false)
  const isMobile = useIsMobile()

  const productById = useMemo(() => new Map(products.map((p) => [p.product_id, p])), [products])
  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products])
  const colorOf = (cat: string) => {
    const i = categories.indexOf(cat)
    return i < 0 ? UNKNOWN_COLOR : CATEGORY_COLORS[i % CATEGORY_COLORS.length]
  }

  // ทุกเมนู พร้อมชื่อและหมวด เรียงตามตัวชี้วัดที่เลือก
  const items = useMemo(
    () =>
      salesByProduct(rows)
        .map((p) => {
          const info = productById.get(p.product_id)
          return { ...p, name: info?.product_name ?? p.product_id, category: info?.category ?? 'ไม่ทราบหมวด' }
        })
        .sort((a, b) => b[metric] - a[metric]),
    [rows, productById, metric],
  )
  const totalSales = items.reduce((s, p) => s + p.sales, 0)
  const totalQty = items.reduce((s, p) => s + p.qty, 0)

  // สรุปรายหมวด (ไม่ขึ้นกับตัวกรองหมวด เพื่อให้เห็นภาพรวมเสมอ)
  const byCategory = useMemo(() => {
    const map = new Map<string, { category: string; sales: number; qty: number; menus: number }>()
    for (const p of items) {
      const c = map.get(p.category) ?? { category: p.category, sales: 0, qty: 0, menus: 0 }
      c.sales += p.sales
      c.qty += p.qty
      c.menus++
      map.set(p.category, c)
    }
    return [...map.values()].sort((a, b) => b[metric] - a[metric])
  }, [items, metric])

  const filtered = category ? items.filter((p) => p.category === category) : items
  const shown = showAll ? filtered : filtered.slice(0, TOP_N)
  const total = metric === 'sales' ? totalSales : totalQty
  const fmt = (v: number) => (metric === 'sales' ? formatBaht(v) : `${formatNumber(v)} ชิ้น`)
  const tick = { ...AXIS_TICK, fontSize: isMobile ? 11 : 12 }
  const nameWidth = isMobile ? 112 : 168
  const maxChars = isMobile ? 12 : 20

  return (
    <Card
      title="ยอดขายแยกตามเมนู"
      subtitle={`${metric === 'sales' ? 'ยอดขาย' : 'จำนวนที่ขายได้'} · ${showAll || filtered.length <= TOP_N ? `ทั้งหมด ${filtered.length} เมนู` : `${TOP_N} อันดับแรก`}${category ? ` ในหมวด${category}` : ''}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="กรองหมวดเมนู" className={SELECT_CLASS} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">ทุกหมวด</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="flex rounded-full bg-stone-100 p-0.5 text-xs font-medium">
            {(
              [
                ['sales', 'ยอดขาย'],
                ['qty', 'จำนวนชิ้น'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMetric(key)}
                aria-pressed={metric === key}
                className={`rounded-full px-3 py-1 ${metric === key ? 'bg-white text-[#c02d74] shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div style={{ height: shown.length * 30 + 32 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shown} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => (metric === 'sales' ? formatBahtCompact(v) : formatNumber(v))}
                  tick={tick}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={tick}
                  tickLine={false}
                  axisLine={false}
                  width={nameWidth}
                  interval={0}
                  tickFormatter={(n: string) => (n.length > maxChars ? `${n.slice(0, maxChars - 1)}…` : n)}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  cursor={{ fill: '#faf5ff' }}
                  content={({ active, payload }) => {
                    const p = active && payload?.[0]?.payload
                    if (!p) return null
                    return (
                      <div className="rounded-[10px] bg-white px-3 py-2 text-[13px] shadow-[0_8px_24px_rgba(60,30,90,0.15)]">
                        <p className="font-medium text-stone-800">{p.name}</p>
                        <p className="text-xs text-stone-400">{p.category}</p>
                        <p className="mt-1 tabular-nums text-stone-600">ยอดขาย {formatBaht(p.sales)} ({formatPercent(p.share)})</p>
                        <p className="tabular-nums text-stone-600">ขายได้ {formatNumber(p.qty)} ชิ้น</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey={metric} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
                  {shown.map((p) => (
                    <Cell key={p.product_id} fill={colorOf(p.category)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {filtered.length > TOP_N && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-xs font-medium text-[#c02d74] hover:underline"
            >
              {showAll ? `แสดงแค่ ${TOP_N} อันดับแรก` : `แสดงทั้งหมด ${filtered.length} เมนู`}
            </button>
          )}
        </div>

        {/* สรุปรายหมวด: กดเพื่อกรอง */}
        <div className="lg:col-span-2">
          <p className="mb-2 text-xs font-medium text-stone-500">สัดส่วน{metric === 'sales' ? 'ยอดขาย' : 'จำนวนชิ้น'}ตามหมวด · กดเพื่อกรอง</p>
          <ul className="space-y-1">
            {byCategory.map((c) => {
              const share = total ? c[metric] / total : 0
              const on = category === c.category
              return (
                <li key={c.category}>
                  <button
                    type="button"
                    onClick={() => setCategory(on ? '' : c.category)}
                    aria-pressed={on}
                    className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-left text-xs ${
                      on ? 'bg-pink-50 ring-1 ring-pink-200' : 'hover:bg-stone-50'
                    } ${category && !on ? 'opacity-50' : ''}`}
                  >
                    <span className="flex items-center gap-1.5 text-stone-700">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(c.category) }} />
                      {c.category}
                      <span className="text-stone-400">· {c.menus} เมนู</span>
                    </span>
                    <span className="tabular-nums text-stone-700">
                      {fmt(c[metric])} <span className="text-stone-400">({formatPercent(share)})</span>
                    </span>
                    <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <span className="block h-full rounded-full" style={{ width: `${share * 100}%`, background: colorOf(c.category) }} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Card>
  )
}
