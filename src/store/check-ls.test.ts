import { describe, it } from 'vitest'
describe('localStorage check', () => {
  it('shows what localStorage is', () => {
    console.log('typeof localStorage:', typeof localStorage)
    console.log('typeof localStorage.setItem:', typeof localStorage?.setItem)
    console.log('typeof window:', typeof window)
    console.log('typeof window.localStorage:', typeof window?.localStorage)
    console.log('window.localStorage === localStorage:', window?.localStorage === localStorage)
  })
})
