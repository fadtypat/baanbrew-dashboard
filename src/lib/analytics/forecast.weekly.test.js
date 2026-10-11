import { describe, it, expect } from "vitest";
import { weekStart, weeklyView, weeklyBacktest, seasonalForecast, backtest } from "./forecast.js";
import { addDays } from "../../lab3/time.js";

// ร้านจำลองเดียวกับ forecast.test.js: จ–ศ 1,000 · ส–อา 200 เริ่มวันจันทร์ 5 ม.ค. 2026 (สัปดาห์ละ 5,400)
const office = Array.from({ length: 70 }, (_, i) => {
  const date = addDays("2026-01-05", i);
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  return { date, revenue: dow === 0 || dow === 6 ? 200 : 1000 };
});

describe("weekStart", () => {
  it("คืนวันจันทร์ของสัปดาห์ (อาทิตย์นับเป็นวันสุดท้ายของสัปดาห์)", () => {
    expect(weekStart("2026-01-05")).toBe("2026-01-05"); // จันทร์
    expect(weekStart("2026-01-11")).toBe("2026-01-05"); // อาทิตย์
    expect(weekStart("2026-01-12")).toBe("2026-01-12"); // จันทร์ถัดไป
    expect(weekStart("2026-01-01")).toBe("2025-12-29"); // ข้ามปี
  });
});

describe("weeklyView", () => {
  it("รวมยอดจริงรายสัปดาห์ครบ 7 วัน และรวมคาดการณ์ 28 วันเป็น 4 สัปดาห์", () => {
    const fc = seasonalForecast(office, 28); // series จบวันอาทิตย์ → ตรงขอบสัปดาห์พอดี
    const w = weeklyView(office, fc);
    expect(w.filter((x) => x.actual !== undefined)).toHaveLength(10);
    expect(w.filter((x) => x.forecast !== undefined)).toHaveLength(4);
    expect(w[0].actual).toBe(5400);
    expect(w.at(-1).forecast).toBe(5400);
  });
  it("ไม่แสดงสัปดาห์ที่ข้อมูลไม่ครบ 7 วัน", () => {
    const w = weeklyView(office.slice(0, 10), []); // จันทร์ถึงพุธสัปดาห์ถัดไป
    expect(w).toEqual([{ week: "2026-01-05", actual: 5400, forecast: undefined }]);
  });
  it("สัปดาห์คาบเกี่ยวรอยต่อ = ยอดจริงที่มี + ที่เหลือเป็นคาดการณ์", () => {
    const series = office.slice(0, 66); // 9 สัปดาห์เต็ม + จันทร์–พุธ → ขาดพฤหัส–อาทิตย์ของสัปดาห์ที่ 10
    const w = weeklyView(series, seasonalForecast(series, 7));
    const mixed = w.find((x) => x.week === addDays("2026-01-05", 63));
    expect(mixed.actual).toBeUndefined();
    expect(mixed.forecast).toBe(5400);
  });
});

describe("weeklyBacktest", () => {
  it("MAPE รายสัปดาห์ ใช้เฉพาะสัปดาห์ครบ 7 วัน", () => {
    const bt = backtest(office, 28); // ทดสอบ 28 วันสุดท้าย = 4 สัปดาห์เต็ม
    const wk = weeklyBacktest(bt.test);
    expect(wk.weeks).toHaveLength(4);
    expect(wk.mapeSeasonal).toBeCloseTo(0);
    expect(wk.mapeFlat).toBeGreaterThanOrEqual(0);
  });
  it("ช่วงทดสอบเริ่มกลางสัปดาห์ → ตัดสัปดาห์ที่ไม่ครบออก", () => {
    const wk = weeklyBacktest(backtest(office.slice(0, 66), 28).test);
    expect(wk.weeks.length).toBeLessThanOrEqual(3);
    expect(wk.weeks.every((w) => new Date(w.week + "T00:00:00Z").getUTCDay() === 1)).toBe(true);
  });
  it("ไม่มีสัปดาห์ครบเลย → mape เป็น null", () => {
    expect(weeklyBacktest(backtest(office, 5).test).mapeSeasonal).toBeNull();
  });
});
