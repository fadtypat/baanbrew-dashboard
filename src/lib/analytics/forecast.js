// Lab 4.4 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.4A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.4 · พยากรณ์ยอดขายแบบอธิบายได้ และวัดความแม่นด้วยการย้อนทดสอบ (backtest)
import { addDays } from "../../lab3/time.js";

/** ค่าเฉลี่ยยอดขายวันเดียวกันของสัปดาห์ K ครั้งล่าสุด (ฤดูกาลรายสัปดาห์) */
export function seasonalForecast(series, horizon, K = 8) {
  const byDate = new Map(series.map((s) => [s.date, s.revenue]));
  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => {
    const date = addDays(last, i + 1);
    // วันเดียวกันของสัปดาห์ย้อนหลัง K สัปดาห์ (ข้ามสัปดาห์ที่ไม่มีข้อมูล)
    const samples = [];
    for (let w = 1; w <= K; w++) {
      const v = byDate.get(addDays(date, -7 * w));
      if (v !== undefined) samples.push(v);
    }
    const forecast = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
    return { date, forecast };
  });
}

/** ค่าเฉลี่ย K วันล่าสุด เส้นตรง (ตัวเปรียบเทียบที่ไม่สนวันในสัปดาห์) */
export function flatForecast(series, horizon, K = 28) {
  const recent = series.slice(-K);
  const avg = recent.reduce((a, s) => a + s.revenue, 0) / recent.length;
  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => ({ date: addDays(last, i + 1), forecast: avg }));
}

/** Mean Absolute Percentage Error (%) · ข้ามวันที่ยอดจริงเป็น 0 เพราะหารไม่ได้ */
export function mape(actual, forecast) {
  let sum = 0;
  let n = 0;
  actual.forEach((a, i) => {
    if (a === 0) return;
    sum += Math.abs(a - forecast[i]) / a;
    n++;
  });
  return n ? (sum / n) * 100 : 0;
}

/**
 * ย้อนทดสอบ: ซ่อน horizon วันสุดท้าย พยากรณ์จากข้อมูลก่อนหน้า แล้วเทียบกับของจริง
 * band = ±1.28 × ส่วนเบี่ยงเบนมาตรฐานของ % ความคลาดเคลื่อน (ช่วงประมาณ 80%)
 */
export function backtest(series, horizon = 28, K = 8) {
  if (series.length <= horizon) throw new Error(`ข้อมูลไม่พอย้อนทดสอบ ${horizon} วัน (มี ${series.length} วัน)`);
  const train = series.slice(0, -horizon);
  const actualRows = series.slice(-horizon);
  const seasonal = seasonalForecast(train, horizon, K);
  const flat = flatForecast(train, horizon);
  const actual = actualRows.map((s) => s.revenue);

  // % ความคลาดเคลื่อนแบบมีเครื่องหมาย (จริง − พยากรณ์) / จริง เฉพาะวันที่ยอดจริงไม่เป็น 0
  const errs = actual.map((a, i) => (a === 0 ? null : (a - seasonal[i].forecast) / a)).filter((e) => e !== null);
  const mean = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
  const sd = errs.length ? Math.sqrt(errs.reduce((a, e) => a + (e - mean) ** 2, 0) / errs.length) : 0;

  return {
    mapeSeasonal: mape(actual, seasonal.map((f) => f.forecast)),
    mapeFlat: mape(actual, flat.map((f) => f.forecast)),
    band: 1.28 * sd,
    test: actualRows.map((s, i) => ({ date: s.date, actual: s.revenue, seasonal: seasonal[i].forecast, flat: flat[i].forecast })),
  };
}

/** วันจันทร์ของสัปดาห์ที่วันนั้นอยู่ (สัปดาห์ = จันทร์–อาทิตย์) · หาวันในสัปดาห์แบบ UTC จึงไม่ขึ้นกับ timezone ของเครื่อง */
export function weekStart(ymd) {
  const day = new Date(ymd + "T00:00:00Z").getUTCDay(); // 0 = อาทิตย์
  return addDays(ymd, -((day + 6) % 7));
}

/**
 * รวมยอดจริง (series) และยอดคาดการณ์ (fc) เป็นรายสัปดาห์ จันทร์–อาทิตย์ → [{ week, actual?, forecast? }]
 * - actual: มีเมื่อสัปดาห์นั้นมียอดจริงครบ 7 วัน
 * - forecast: มีเมื่อยอดจริง + ยอดคาดการณ์ รวมกันครบ 7 วัน (สัปดาห์ที่คาบเกี่ยวรอยต่อ = ยอดจริงที่มี + ที่เหลือเป็นคาดการณ์)
 * สัปดาห์ที่ข้อมูลไม่ครบ 7 วันจะไม่แสดง เพราะยอดต่ำกว่าปกติจะหลอกตา (กับดักเดียวกับเดือนที่ไม่ครบ)
 */
export function weeklyView(series, fc) {
  const weeks = new Map();
  const bucket = (date) => {
    const k = weekStart(date);
    if (!weeks.has(k)) weeks.set(k, { aDays: 0, aSum: 0, fDays: 0, fSum: 0 });
    return weeks.get(k);
  };
  for (const s of series) { const b = bucket(s.date); b.aDays++; b.aSum += s.revenue; }
  for (const f of fc) { const b = bucket(f.date); b.fDays++; b.fSum += f.forecast; }
  return [...weeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, b]) => ({
      week,
      actual: b.aDays === 7 ? b.aSum : undefined,
      forecast: b.fDays > 0 && b.aDays + b.fDays === 7 ? b.aSum + b.fSum : undefined,
    }))
    .filter((w) => w.actual !== undefined || w.forecast !== undefined);
}

/**
 * MAPE รายสัปดาห์จากผล backtest().test (แต่ละแถว { date, actual, seasonal, flat })
 * ใช้เฉพาะสัปดาห์จันทร์–อาทิตย์ที่อยู่ในช่วงทดสอบครบ 7 วัน
 * @returns {{ weeks: {week, actual, seasonal, flat}[], mapeSeasonal: number|null, mapeFlat: number|null }}
 *   mape เป็น null ถ้าช่วงทดสอบไม่มีสัปดาห์ครบเลย
 */
export function weeklyBacktest(test) {
  const groups = new Map();
  for (const t of test) {
    const k = weekStart(t.date);
    const g = groups.get(k) ?? { week: k, days: 0, actual: 0, seasonal: 0, flat: 0 };
    g.days++; g.actual += t.actual; g.seasonal += t.seasonal; g.flat += t.flat;
    groups.set(k, g);
  }
  const weeks = [...groups.values()].filter((g) => g.days === 7).sort((a, b) => a.week.localeCompare(b.week));
  if (!weeks.length) return { weeks, mapeSeasonal: null, mapeFlat: null };
  const actual = weeks.map((w) => w.actual);
  return {
    weeks,
    mapeSeasonal: mape(actual, weeks.map((w) => w.seasonal)),
    mapeFlat: mape(actual, weeks.map((w) => w.flat)),
  };
}
