// Type declarations สำหรับ Lab2Page.jsx (ให้ App.tsx import ได้แบบมี type)
import type { JSX } from 'react'
import type { PreparedRow } from '../lib/metrics.js'

export default function Lab2Page(props: {
  rows: PreparedRow[]
  products: { product_id: string; product_name: string }[]
}): JSX.Element
