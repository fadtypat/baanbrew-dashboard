// Lab 4.5 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.5A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.5 · หาวันที่ยอดขายผิดปกติ
// เทียบกับ "ค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน" ไม่ใช่ค่าเฉลี่ย 28 วัน
// เพราะสาขาออฟฟิศกับห้างขายวันธรรมดาและเสาร์-อาทิตย์ต่างกันมาก
import { addDays } from "../../lab3/time.js";
import { toSeries } from "./daily.js";

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

/**
 * คะแนนความผิดปกติ = ln((จริง + SMOOTH) / (คาดหวัง + SMOOTH))
 * SMOOTH กันไม่ให้วันยอดน้อย ๆ (เช่น 50 บาท เทียบ 100 บาท) ดูผิดปกติเกินจริง
 * @param daily    [{ date, branch, revenue }] จาก dailyByBranch()
 * @param holidays { "YYYY-MM-DD": "ชื่อวันหยุด" } วันหยุดจะไม่ถูกจัดอันดับ แต่ติดป้ายไว้
 * @returns ทุกวันที่คำนวณได้ เรียงจากผิดปกติมากไปน้อย:
 *   { date, branch, actual, expected, change (สัดส่วน เช่น -0.9 = ต่ำกว่าปกติ 90%), score, holiday }
 */
export function scoreAnomalies(daily, holidays = {}, { weeks = 8, minWeeks = 4, smooth = 1000 } = {}) {
  const out = [];
  for (const branch of new Set(daily.map((d) => d.branch))) {
    const series = toSeries(daily, branch); // ต่อเนื่อง วันที่ไม่มียอดเป็น 0
    const byDate = new Map(series.map((s) => [s.date, s.revenue]));
    for (const { date, revenue: actual } of series) {
      // วันเดียวกันของสัปดาห์ย้อนหลัง (เฉพาะสัปดาห์ที่มีข้อมูลของสาขานี้)
      const samples = [];
      for (let w = 1; w <= weeks; w++) {
        const v = byDate.get(addDays(date, -7 * w));
        if (v !== undefined) samples.push(v);
      }
      if (samples.length < minWeeks) continue;
      const expected = median(samples);
      out.push({
        date, branch, actual, expected,
        change: expected > 0 ? actual / expected - 1 : actual > 0 ? 1 : 0,
        score: Math.log((actual + smooth) / (expected + smooth)),
        holiday: holidays[date] ?? null,
      });
    }
  }
  return out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

/** อันดับวันผิดปกติที่ควรตรวจสอบ (ไม่รวมวันหยุด) */
export function topAnomalies(daily, holidays = {}, n = 15, opts) {
  return scoreAnomalies(daily, holidays, opts).filter((a) => !a.holiday).slice(0, n);
}
