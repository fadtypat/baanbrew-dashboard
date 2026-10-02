// แท็บ "ข้อมูลลูกค้า": ภาพรวมสมาชิกจาก customers.csv เลือกช่วงวันที่ได้
import { useEffect, useMemo, useState } from 'react'
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBaht, formatNumber, formatPercent, formatThaiDate, type SaleRow } from '../lib/metrics.js'
import {
  AGE_GROUPS,
  customerReport,
  dataBounds,
  GENDERS,
  joinShareByMonth,
  parseCsv,
  type Branch,
  type Customer,
  type DateRange,
} from '../lib/customerMetrics.ts'
import { Card, GradientTile, LegendDot } from '../components/ui.tsx'
import FilterBar from '../components/FilterBar.tsx'
import { AMBER, AXIS_TICK, BLUE, GRID_COLOR, PINK, PURPLE, TEAL, TOOLTIP_STYLE, useIsMobile } from '../components/theme.ts'

const NEVER_COLOR = '#f3b5d2' // สมาชิกที่ยังไม่เคยซื้อ (ชมพูจาง)
const PARTIAL_COLOR = '#c9bcd9' // เส้นประของเดือนที่ไม่ครบเดือน
const GENDER_COLORS: Record<string, string> = { หญิง: PINK, ชาย: BLUE, ไม่ระบุ: '#b9acc9' }

/** 'YYYY-MM' → 'เม.ย. 68' */
const monthLabel = (m: string) => formatThaiDate(`${m}-01`, { year: 'short' }).replace(/^1 /, '')

const SELECT_CLASS = 'rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-700 focus:border-[#e0428f] focus:outline-none'

/** dropdown กรองเพศ + ช่วงอายุ ('' = ทั้งหมด) ใช้ในหัวการ์ดกราฟ */
function GenderAgeFilters({
  label,
  gender,
  age,
  onGender,
  onAge,
}: {
  label: string
  gender: string
  age: string
  onGender: (g: string) => void
  onAge: (a: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <select aria-label={`กรองเพศ (${label})`} className={SELECT_CLASS} value={gender} onChange={(e) => onGender(e.target.value)}>
        <option value="">ทุกเพศ</option>
        {GENDERS.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
      <select aria-label={`กรองช่วงอายุ (${label})`} className={SELECT_CLASS} value={age} onChange={(e) => onAge(e.target.value)}>
        <option value="">ทุกช่วงอายุ</option>
        {AGE_GROUPS.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    </div>
  )
}

const whoLabel = (gender: string, age: string) => [gender || 'ทุกเพศ', age ? `อายุ ${age}` : 'ทุกช่วงอายุ'].join(' · ')

/** ความชัน (คน/เดือน) ของเส้นตรงที่ fit ได้ดีที่สุด (least squares) กับจำนวนสมัครรายเดือน */
function slope(values: number[]) {
  const n = values.length
  if (n < 2) return 0
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  values.forEach((y, x) => {
    num += (x - xMean) * (y - yMean)
    den += (x - xMean) ** 2
  })
  return num / den
}

/**
 * กราฟแนวโน้มการสมัครสมาชิกรายเดือน (เรียงตามเวลา) พร้อมตัวกรองเพศ / ช่วงอายุ
 * - เส้นทึบ = เดือนที่ครบ · เส้นประ = เดือนที่ไม่ครบเดือน (ต่อจากจุดข้างเคียง)
 * - เส้นค่าเฉลี่ย 3 เดือน คิดจากเดือนที่ครบเท่านั้น
 */
function JoinTrendCard({ customers, range, partialMonths }: { customers: Customer[]; range: DateRange; partialMonths: string[] }) {
  const [gender, setGender] = useState('')
  const [age, setAge] = useState('')
  const isMobile = useIsMobile()
  const { total, months } = useMemo(() => joinShareByMonth(customers, range, gender, age), [customers, range, gender, age])

  const data = useMemo(() => {
    const byTime = [...months].sort((a, b) => a.month.localeCompare(b.month))
    const isPartial = byTime.map((m) => partialMonths.includes(m.month))
    return byTime.map((m, i) => {
      const window = byTime.slice(Math.max(0, i - 2), i + 1)
      const windowFull = window.length === 3 && [i - 2, i - 1, i].every((k) => !isPartial[k])
      return {
        month: m.month,
        count: m.count,
        full: isPartial[i] ? null : m.count,
        // จุดเดือนไม่ครบ + จุดข้างเคียง เพื่อให้เส้นประต่อกับเส้นทึบ
        partial: isPartial[i] || isPartial[i - 1] || isPartial[i + 1] ? m.count : null,
        avg3: windowFull ? window.reduce((sum, w) => sum + w.count, 0) / 3 : null,
      }
    })
  }, [months, partialMonths])

  const fullPoints = data.filter((d) => d.full !== null)
  const perMonth = slope(fullPoints.map((d) => d.count))
  const first = fullPoints[0]
  const last = fullPoints[fullPoints.length - 1]
  const change = first && last && first !== last && first.count ? (last.count - first.count) / first.count : null
  const tick = { ...AXIS_TICK, fontSize: isMobile ? 11 : 12 }
  const trendText = Math.abs(perMonth) < 0.05 ? 'ทรงตัว' : `${perMonth > 0 ? '+' : ''}${perMonth.toFixed(1)} คน/เดือน`
  const tone = (x: number) => (x >= 0 ? 'text-emerald-700' : 'text-red-700')
  const stats = [
    { label: 'แนวโน้ม', value: trendText, tone: tone(perMonth) },
    ...(change !== null
      ? [{ label: `${monthLabel(first.month)} → ${monthLabel(last.month)}`, value: `${change >= 0 ? '+' : ''}${formatPercent(change)}`, tone: tone(change) }]
      : []),
    { label: 'สมาชิกที่ตรงเงื่อนไข', value: `${formatNumber(total)} คน`, tone: 'text-stone-800' },
  ]

  return (
    <Card
      title="แนวโน้มการสมัครสมาชิกรายเดือน"
      subtitle={`เรียงตามเวลา · ${whoLabel(gender, age)}`}
      action={<GenderAgeFilters label="แนวโน้ม" gender={gender} age={age} onGender={setGender} onAge={setAge} />}
    >
      {total === 0 ? (
        <p className="py-12 text-center text-sm text-stone-500">ไม่มีสมาชิกที่ตรงกับเงื่อนไขนี้</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <dl className="flex flex-wrap gap-2">
              {stats.map((x) => (
                <div key={x.label} className="rounded-xl bg-[#faf5ff] px-3 py-2">
                  <dt className="text-xs text-stone-500">{x.label}</dt>
                  <dd className={`text-sm font-semibold tabular-nums ${x.tone}`}>{x.value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center gap-4">
              <LegendDot color={PINK} label="สมัครใหม่" line />
              <LegendDot color={PURPLE} label="ค่าเฉลี่ย 3 เดือน" line />
              {partialMonths.length > 0 && <LegendDot color={PARTIAL_COLOR} label="ไม่ครบเดือน" line />}
            </div>
          </div>
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={isMobile ? { top: 8, right: 8, bottom: 0, left: -16 } : { top: 8, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PINK} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={PINK} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={tick} tickLine={false} axisLine={false} minTickGap={isMobile ? 12 : 4} />
                <YAxis tick={tick} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  labelFormatter={(m) => monthLabel(String(m)) + (partialMonths.includes(String(m)) ? ' (ไม่ครบเดือน)' : '')}
                  formatter={(v, name) => [`${Number(v).toFixed(name === 'ค่าเฉลี่ย 3 เดือน' ? 1 : 0)} คน`, name === 'partial' ? 'สมัครใหม่' : name]}
                />
                <Area
                  type="monotone"
                  dataKey="full"
                  name="สมัครใหม่"
                  stroke={PINK}
                  strokeWidth={2.5}
                  fill="url(#trendFill)"
                  dot={{ r: 3, fill: PINK, stroke: '#fff', strokeWidth: 1.5 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="partial"
                  name="partial"
                  stroke={PARTIAL_COLOR}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={false}
                  tooltipType="none"
                  isAnimationActive={false}
                />
                <Line type="monotone" dataKey="avg3" name="ค่าเฉลี่ย 3 เดือน" stroke={PURPLE} strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-stone-500">
            แนวโน้ม = ความชันของเส้นตรงที่ fit กับจำนวนสมัครของเดือนที่ครบ
            {partialMonths.length > 0 && ` · ${partialMonths.map(monthLabel).join(', ')} ไม่ครบเดือน แสดงเป็นเส้นประและไม่นำมาคิดแนวโน้ม`}
          </p>
        </>
      )}
    </Card>
  )
}

async function fetchCsv<T>(path: string) {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`โหลด ${path.slice(1)} ไม่สำเร็จ (${res.status})`)
  return parseCsv<T>(await res.text())
}

export default function CustomersPage({ rows }: { rows: SaleRow[] }) {
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<DateRange | null>(null) // null = ทั้งหมด
  const isMobile = useIsMobile()

  useEffect(() => {
    Promise.all([fetchCsv<Customer>('/customers.csv'), fetchCsv<Branch>('/branches.csv')])
      .then(([c, b]) => {
        setBranches(b)
        setCustomers(c)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const bounds = useMemo(() => (customers ? dataBounds(customers, rows) : null), [customers, rows])
  const range = picked ?? bounds
  const report = useMemo(
    () => (customers && range ? customerReport(customers, branches, rows, range) : null),
    [customers, branches, rows, range],
  )

  if (error) return <p className="py-16 text-center text-red-700">{error}</p>
  if (!report || !range || !bounds) return <p className="py-16 text-center text-stone-500">กำลังโหลดข้อมูลลูกค้า…</p>

  const tick = { ...AXIS_TICK, fontSize: isMobile ? 11 : 12 }
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-800 sm:text-2xl">ข้อมูลลูกค้า</h1>
        <p className="text-xs text-stone-400 sm:text-sm">
          สมาชิกที่สมัครระหว่าง {formatThaiDate(range.from)} – {formatThaiDate(range.to)} · นับการซื้อและยอดขายในช่วงเดียวกัน
        </p>
      </div>

      <FilterBar range={range} bounds={bounds} onRangeChange={setPicked} />

      {report.total === 0 ? (
        <p className="rounded-2xl bg-white py-16 text-center text-sm text-stone-500">ไม่มีสมาชิกที่สมัครในช่วงวันที่นี้</p>
      ) : (
      <>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        <GradientTile label="สมาชิกทั้งหมด" value={formatNumber(report.total)} hint="สมัครในช่วงที่เลือก" icon="member" gradient="bg-gradient-to-br from-[#f0508f] to-[#b83aae]" />
        <GradientTile
          label="เคยซื้อแล้ว"
          value={formatNumber(report.active)}
          hint={`${formatPercent(report.active / report.total)} ของสมาชิก`}
          icon="active"
          gradient="bg-gradient-to-br from-[#9a4cf0] to-[#5b2fd6]"
        />
        <GradientTile
          label="ยังไม่เคยซื้อ"
          value={formatNumber(report.neverBought)}
          hint={`${formatPercent(report.neverRecentShare)} สมัครใน 3 เดือนท้ายช่วง`}
          icon="sleep"
          gradient="bg-gradient-to-br from-[#3d95e8] to-[#3a5fd9]"
        />
        <GradientTile
          label="ยอดขายจากสมาชิก"
          value={formatPercent(report.memberSalesShare)}
          hint={`ต่อบิล ${formatBaht(Math.round(report.memberOrders.aov))} vs ทั่วไป ${formatBaht(Math.round(report.walkinOrders.aov))}`}
          icon="sales"
          gradient="bg-gradient-to-br from-[#f2a43a] to-[#ec6a3c]"
        />
      </div>

      {/* สมัครรายเดือน + ประชากร */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <Card
          title="สมาชิกใหม่รายเดือน"
          subtitle="แยกตามว่าเคยซื้อแล้วหรือยัง"
          className="xl:col-span-2"
          action={
            <div className="flex items-center gap-4">
              <LegendDot color={PURPLE} label="เคยซื้อแล้ว" />
              <LegendDot color={NEVER_COLOR} label="ยังไม่เคยซื้อ" />
            </div>
          }
        >
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.monthly} margin={isMobile ? { top: 4, right: 4, bottom: 0, left: -16 } : { top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={tick} tickLine={false} axisLine={false} minTickGap={isMobile ? 12 : 4} />
                <YAxis tick={tick} tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  cursor={{ fill: '#faf5ff' }}
                  labelFormatter={(m) => monthLabel(String(m)) + (report.partialMonths.includes(String(m)) ? ' (ไม่ครบเดือน)' : '')}
                  formatter={(v, name) => [`${formatNumber(Number(v))} คน`, name]}
                />
                <Bar dataKey="bought" name="เคยซื้อแล้ว" stackId="m" fill={PURPLE} maxBarSize={36} isAnimationActive={false}>
                  {report.monthly.map((m) => (
                    <Cell key={m.month} fillOpacity={report.partialMonths.includes(m.month) ? 0.45 : 1} />
                  ))}
                </Bar>
                <Bar dataKey="never" name="ยังไม่เคยซื้อ" stackId="m" fill={NEVER_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                  {report.monthly.map((m) => (
                    <Cell key={m.month} fillOpacity={report.partialMonths.includes(m.month) ? 0.45 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {report.partialMonths.length > 0 && (
            <p className="mt-3 text-xs text-stone-500">
              แท่งจาง = {report.partialMonths.map(monthLabel).join(', ')} มีข้อมูลไม่ครบเดือน อย่าเทียบตรง ๆ กับเดือนอื่น ·
              สมาชิกที่ยังไม่เคยซื้อมักกระจุกในเดือนท้าย ๆ เพราะเพิ่งสมัคร ยังไม่ใช่ลูกค้าที่หายไป
            </p>
          )}
        </Card>

        <Card title="ประชากรสมาชิก" subtitle="เพศและช่วงอายุ">
          {/* เพศ: แถบ 100% */}
          <div className="flex h-3 overflow-hidden rounded-full">
            {report.gender.map((g) => (
              <span key={g.gender} style={{ width: `${g.share * 100}%`, background: GENDER_COLORS[g.gender] }} title={`${g.gender} ${formatPercent(g.share)}`} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {report.gender.map((g) => (
              <li key={g.gender} className="flex items-center gap-1.5 text-xs text-stone-500">
                <span className="h-2 w-2 rounded-full" style={{ background: GENDER_COLORS[g.gender] }} />
                {g.gender} <span className="font-medium tabular-nums text-stone-700">{formatPercent(g.share)}</span>
              </li>
            ))}
          </ul>

          {/* ช่วงอายุ */}
          <ul className="mt-6 space-y-2.5">
            {report.age.map((a) => {
              const max = Math.max(...report.age.map((x) => x.share))
              const minor = a.age === 'ต่ำกว่า 18'
              return (
                <li key={a.age} className="grid grid-cols-[72px_1fr_64px] items-center gap-2 text-xs">
                  <span className="text-stone-500">{a.age}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                    <span className="block h-full rounded-full" style={{ width: `${(a.share / max) * 100}%`, background: minor ? AMBER : TEAL }} />
                  </span>
                  <span className="text-right tabular-nums text-stone-700">
                    {formatNumber(a.count)} <span className="text-stone-400">({formatPercent(a.share)})</span>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-4 text-xs text-stone-500">
            <span className="font-medium text-amber-700">ต่ำกว่า 18 ปี</span> เป็นข้อมูลผู้เยาว์ (PDPA) ควรแยกออกจากแคมเปญการตลาด
          </p>
        </Card>
      </div>

      <JoinTrendCard customers={customers!} range={range} partialMonths={report.partialMonths} />

      {/* สาขาประจำ */}
      <Card title="สมาชิกตามสาขาประจำ" subtitle="home_branch_id เทียบกับพฤติกรรมการซื้อจริง">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="bg-[#2d2a3e] text-left text-xs text-white">
                <th className="rounded-l-lg px-3 py-2.5 font-medium">สาขา</th>
                <th className="px-3 py-2.5 text-right font-medium">สมาชิก</th>
                <th className="px-3 py-2.5 text-right font-medium">เคยซื้อแล้ว</th>
                <th className="px-3 py-2.5 text-right font-medium">ซื้อที่สาขาประจำบ่อยสุด</th>
                <th className="rounded-r-lg px-3 py-2.5 text-right font-medium">ยอดซื้อเฉลี่ย/คน</th>
              </tr>
            </thead>
            <tbody>
              {report.byBranch.map((b) => (
                <tr key={b.branch} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-3">
                    {b.branch}
                    <span className="ml-2 text-xs text-stone-400">เปิด {formatThaiDate(b.opened, { year: 'short' })}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatNumber(b.members)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatPercent(b.activeShare)}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="inline-block rounded-md bg-pink-50 px-2 py-0.5 text-xs font-medium tabular-nums text-[#c02d74]">
                      {formatPercent(b.loyalShare)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatBaht(Math.round(b.spendPerActive))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.byBranch.some((b) => b.opened > range.from) && (
          <p className="mt-3 text-xs text-stone-500">
            {report.byBranch.filter((b) => b.opened > range.from).map((b) => `${b.branch} (เปิด ${formatThaiDate(b.opened, { year: 'short' })})`).join(', ')}{' '}
            เปิดหลังวันเริ่มต้นของช่วง จึงมีเวลาหาสมาชิกและสะสมยอดซื้อน้อยกว่าสาขาอื่น ไม่ได้แปลว่าสาขาทำได้แย่กว่า
          </p>
        )}
      </Card>

      </>
      )}
    </div>
  )
}
