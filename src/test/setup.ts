import '@testing-library/jest-dom'

// Node 22+ ships a built-in `localStorage` global whose methods are no-ops
// unless `--localstorage-file` points to a valid path. This shadows jsdom's
// implementation and breaks the zustand `persist` middleware. Provide a
// working in-memory Storage so store tests can run.
const memoryStore = new Map<string, string>()
const localStorageShim: Storage = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => {
    memoryStore.set(key, String(value))
  },
  removeItem: (key) => {
    memoryStore.delete(key)
  },
  clear: () => {
    memoryStore.clear()
  },
  key: (index) => Array.from(memoryStore.keys())[index] ?? null,
  get length() {
    return memoryStore.size
  },
}
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageShim,
  writable: true,
  configurable: true,
})
