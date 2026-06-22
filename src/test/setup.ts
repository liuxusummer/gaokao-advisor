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

// jsdom 未实现 window.matchMedia，Ant Design 的 responsiveObserver（Table/Grid 等组件使用）
// 在挂载时会调用 matchMedia，缺少该 API 会导致组件抛错。这里提供一个最小化实现。
// 注意：部分测试（如 scraper 测试）使用 node 环境运行，没有 window 对象，需要先判断。
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
