import fs from 'node:fs'
import path from 'node:path'

export class Cache {
  constructor(private readonly dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  private filePath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_')
    return path.join(this.dir, `${safeKey}.html`)
  }

  get(key: string): string | null {
    const fp = this.filePath(key)
    if (!fs.existsSync(fp)) return null
    return fs.readFileSync(fp, 'utf-8')
  }

  set(key: string, content: string): void {
    const fp = this.filePath(key)
    fs.writeFileSync(fp, content, 'utf-8')
  }

  has(key: string): boolean {
    return fs.existsSync(this.filePath(key))
  }
}
