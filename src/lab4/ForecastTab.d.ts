// Type declarations สำหรับ ForecastTab.jsx (ให้ App.tsx import ได้แบบมี type)
import type { JSX } from 'react'
import type { AnalyticsSource } from './sources.js'

export default function ForecastTab(props: { source: AnalyticsSource }): JSX.Element
