// Lab 4.2 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.2A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.2 · Cohort retention รายเดือน
// cohort = เดือนแรกที่ลูกค้าสมาชิกซื้อ · retention[k] = สัดส่วนลูกค้าใน cohort ที่กลับมาซื้อในเดือนที่ k (k=0 คือเดือนแรก = 100%)

/** จำนวนเดือนจาก a ถึง b เช่น monthIndex("2025-11", "2026-02") = 3 */
export function monthIndex(a, b) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** บวกเดือนให้ "YYYY-MM" เช่น addMonths("2025-11", 3) = "2026-02" */
function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/**
 * @param rows  แถวยอดขาย (ไม่นับ customer_id ว่าง)
 * @param asOf  วันสุดท้ายของข้อมูล YYYY-MM-DD ใช้บอกว่าเดือนสุดท้ายข้อมูลไม่ครบหรือไม่
 * @returns {{ cohorts: {cohort, size, retention: number[]}[], lastMonth, lastMonthPartial, daysInLastMonth }}
 *   retention ยาวเท่าจำนวนเดือนที่สังเกตได้ของ cohort นั้น (ถึง lastMonth)
 */
export function computeCohorts(rows, asOf) {
  const lastMonth = asOf.slice(0, 7);
  const daysInLastMonth = Number(asOf.slice(8, 10));
  const [y, m] = lastMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate(); // วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้

  // เดือนที่ลูกค้าแต่ละคนซื้อ (Set ต่อคน จึงนับซ้ำในเดือนเดียวกันครั้งเดียว) · ไม่นับ walk-in และแถวหลัง asOf
  const monthsOf = new Map();
  for (const row of rows) {
    if (!row.customer_id || row.date > asOf) continue;
    let set = monthsOf.get(row.customer_id);
    if (!set) monthsOf.set(row.customer_id, (set = new Set()));
    set.add(row.date.slice(0, 7));
  }

  // จัดลูกค้าเข้า cohort ตามเดือนแรกที่ซื้อ
  const byCohort = new Map();
  for (const months of monthsOf.values()) {
    const first = [...months].sort()[0];
    if (!byCohort.has(first)) byCohort.set(first, []);
    byCohort.get(first).push(months);
  }

  const cohorts = [...byCohort.keys()].sort().map((cohort) => {
    const members = byCohort.get(cohort);
    const observed = monthIndex(cohort, lastMonth) + 1; // เดือนที่สังเกตได้ รวมเดือน 0
    const retention = Array.from({ length: observed }, (_, k) => {
      const ym = addMonths(cohort, k);
      return members.filter((months) => months.has(ym)).length / members.length;
    });
    return { cohort, size: members.length, retention };
  });

  return { cohorts, lastMonth, lastMonthPartial: daysInLastMonth < daysInMonth, daysInLastMonth, daysInMonth };
}
