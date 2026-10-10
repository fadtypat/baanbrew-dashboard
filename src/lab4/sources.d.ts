// Type declarations สำหรับ sources.js
export interface AnalyticsSource {
  onAuth(cb: (user: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null) => void): () => void
  signIn(): Promise<unknown>
  signOut(): Promise<unknown>
  loadAnalytics(): Promise<Record<string, unknown> & { reads: number }>
}

export const isDemo: () => boolean
export const firestoreSource: AnalyticsSource
export const demoSource: AnalyticsSource
export const analyticsSource: () => AnalyticsSource
