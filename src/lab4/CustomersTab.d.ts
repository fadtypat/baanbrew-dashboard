// Type declarations สำหรับ CustomersTab.jsx (ให้ App.tsx import ได้แบบมี type)
import type { JSX } from 'react'
import type { AnalyticsSource } from './sources.js'

export default function CustomersTab(props: { source: AnalyticsSource }): JSX.Element
