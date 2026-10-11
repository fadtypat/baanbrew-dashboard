# Day 4: Advanced Data Analytics · บ้านบรู

เสาร์ 10 ต.ค. 2026 · ต่อจาก Day 3 (Firestore + Vercel ผ่าน Claude Code และ GitHub)

เริ่มที่ **`LAB4_GUIDE.md`** · prompt ทั้งหมดอยู่ใน **`PROMPTS_LAB4.md`** · กติกาที่ Claude Code อ่านอัตโนมัติอยู่ใน **`CLAUDE.md`**

```bash
npm install
npm test                 # ตอนเริ่มจะมี test แดงของ rfm, cohort, forecast, anomaly เป็นเรื่องปกติ
npm run dev              # แล้วเปิด http://localhost:5173/?demo เพื่อลองโดยไม่ใช้โควตา Firebase
```

## สิ่งที่เพิ่มจาก Day 3

| ไฟล์ | Lab | สถานะ |
|---|---|---|
| `src/lib/analytics/rfm.js` | 4.1 | **คุณเขียน** ให้ผ่าน `rfm.test.js` |
| `src/lib/analytics/cohort.js` | 4.2 | **คุณเขียน** ให้ผ่าน `cohort.test.js` |
| `src/lib/analytics/abc.js` | 4.2 | ตัวอย่างที่ทำเสร็จแล้ว |
| `src/lib/analytics/forecast.js` | 4.4 | **คุณเขียน** (`flatForecast` เป็นตัวอย่าง) |
| `src/lib/analytics/anomaly.js` | 4.5 | **คุณเขียน** `scoreAnomalies` |
| `src/lib/analytics/realdata.test.js` | ทั้งวัน | ตรวจกับข้อมูลจริง ผ่านเมื่อทุกฟังก์ชันเสร็จ |
| `src/lab4/CustomersTab.jsx`, `ForecastTab.jsx` | 4.1–4.5 | หน้าจอพร้อมใช้ คุณเพิ่มการเจาะดู (4.1B) และการซูม (4.5B) |
| `scripts/build-analytics.mjs` | 4.2, 4.6 | pipeline พร้อมใช้ |
| `.github/workflows/analytics.yml` | 4.6 | รันทุกเช้า 06:15 เวลาไทย |
| `firestore.rules` | 4.2 | **คุณเพิ่ม** สิทธิ์ของ collection `analytics` |
| `CLAUDE.md` | ทั้งวัน | กติกาของโปรเจกต์สำหรับ Claude Code |
| `public/thai_holidays.csv` | 4.5 | วันหยุดราชการ |

## คำสั่งใหม่

```bash
npm run analytics:dry    # คำนวณผลวิเคราะห์และแสดงผล ไม่เขียน ไม่ต้องมี key
npm run analytics        # เขียน 5 เอกสารลง Firestore (ใช้ key ใน secrets/ เดียวกับ Day 3)
```
