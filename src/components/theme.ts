// โทนสีและค่าที่ใช้ร่วมกันทุกแท็บของ Dashboard
import { useEffect, useState } from 'react'

// โทนสีหลัก: ชมพู → ม่วง → ฟ้า → ส้มเหลือง
export const PINK = '#e0428f'
export const PURPLE = '#7c4dff'
export const BLUE = '#2f8fe0'
export const AMBER = '#f0a020'
export const TEAL = '#12a594'
export const MUTED = '#ddd3ea' // สีจางสำหรับข้อมูลรอง
export const AXIS_TICK = { fill: '#9a93a8', fontSize: 12 }
export const GRID_COLOR = '#efeaf5'
export const TOOLTIP_STYLE = {
  contentStyle: {
    border: 'none',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(60, 30, 90, 0.15)',
    fontFamily: 'Prompt, sans-serif',
    fontSize: 13,
  },
}

// true เมื่อจอแคบกว่า breakpoint sm ของ Tailwind (640px) — ใช้ปรับค่าที่ Recharts ต้องรับเป็น prop
export function useIsMobile(query = '(max-width: 639px)') {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}
