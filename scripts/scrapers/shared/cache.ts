import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export class Cache {
  constructor(private readonly dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  private filePath(key: string): string {
    // 如果 key 包含非 ASCII 字符（如中文），使用 hash 作为文件名避免冲突
    const hasNonAscii = /[^\x00-\x7F]/.test(key)
    let safeKey: string
    if (hasNonAscii) {
      const hash = crypto.createHash('md5').update(key).digest('hex').substring(0, 16)
      safeKey = `cache_${hash}`
    } else {
      safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_')
    }
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
