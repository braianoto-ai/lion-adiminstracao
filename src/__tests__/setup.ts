import '@testing-library/jest-dom/vitest'

// Polyfill localStorage for jsdom/vitest
const store = new Map<string, string>()
const localStorageMock: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
  get length() { return store.size },
  key: (index: number) => [...store.keys()][index] ?? null,
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })
