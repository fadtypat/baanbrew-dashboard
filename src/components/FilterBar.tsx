// แถบตัวกรองที่ใช้ร่วมกันทุกแท็บ
import type { DateRange } from '../lib/customerMetrics.ts'

/** เลื่อนวันที่ 'YYYY-MM-DD' ย้อนหลัง N เดือน แล้วบวก 1 วัน (เช่น 3 เดือนถึง 20 ก.ย. = 21 มิ.ย. – 20 ก.ย.) */
function monthsBefore(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - months)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

const PRESETS = [
  { label: 'ทั้งหมด', months: null },
  { label: '3 เดือน', months: 3 },
  { label: '6 เดือน', months: 6 },
  { label: '12 เดือน', months: 12 },
] as const

/**
 * แถบตัวกรองด้านบนของแต่ละแท็บ: ช่วงวันที่ (+ ปุ่มลัด) และสาขา (ถ้าส่ง branches มา)
 * branch = '' หมายถึงทุกสาขา
 */
export default function FilterBar({
  range,
  bounds,
  onRangeChange,
  branches,
  branch = '',
  onBranchChange,
}: {
  range: DateRange
  bounds: DateRange
  onRangeChange: (r: DateRange) => void
  branches?: string[]
  branch?: string
  onBranchChange?: (b: string) => void
}) {
  const presetRange = (months: number | null): DateRange =>
    months === null ? bounds : { from: [monthsBefore(bounds.to, months), bounds.from].sort()[1], to: bounds.to }
  // เลือกวันเริ่มหลังวันจบ → สลับให้เอง
  const set = (from: string, to: string) => onRangeChange(from <= to ? { from, to } : { from: to, to: from })
  const input = 'rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-700 focus:border-[#e0428f] focus:outline-none'

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_4px_24px_rgba(60,30,90,0.06)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {branches && onBranchChange && (
          <>
            <span className="text-sm font-medium text-stone-700">สาขา</span>
            <select aria-label="สาขา" className={`${input} mr-2`} value={branch} onChange={(e) => onBranchChange(e.target.value)}>
              <option value="">ทุกสาขา</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </>
        )}
        <span className="text-sm font-medium text-stone-700">ช่วงวันที่</span>
        <input type="date" aria-label="วันเริ่มต้น" className={input} value={range.from} min={bounds.from} max={bounds.to}
          onChange={(e) => e.target.value && set(e.target.value, range.to)} />
        <span className="text-stone-400">–</span>
        <input type="date" aria-label="วันสิ้นสุด" className={input} value={range.to} min={bounds.from} max={bounds.to}
          onChange={(e) => e.target.value && set(range.from, e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const r = presetRange(p.months)
          const on = r.from === range.from && r.to === range.to
          return (
            <button key={p.label} type="button" onClick={() => onRangeChange(r)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${on ? 'bg-gradient-to-r from-[#e0428f] to-[#7c4dff] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
