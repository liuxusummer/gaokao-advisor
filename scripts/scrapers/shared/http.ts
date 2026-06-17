import axios from 'axios'
import { Cache } from './cache'
import { createLogger } from './logger'
import {
  HTTP_TIMEOUT,
  HTTP_MAX_RETRIES,
  HTTP_RETRY_BASE_DELAY,
  USER_AGENT,
} from '../config'
import type { FetchOptions, FetchResult } from '../types'

const logger = createLogger('http')

export class HttpClient {
  private cache: Cache

  constructor(cacheDir: string) {
    this.cache = new Cache(cacheDir)
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const {
      cacheKey,
      forceRefresh = false,
      timeout = HTTP_TIMEOUT,
    } = options

    if (cacheKey && !forceRefresh && this.cache.has(cacheKey)) {
      const html = this.cache.get(cacheKey)!
      logger.info('缓存命中', { cacheKey, url })
      return {
        html,
        fromCache: true,
        fetchedAt: new Date().toISOString(),
        url,
      }
    }

    const html = await this.fetchWithRetry(url, timeout)

    if (cacheKey) {
      this.cache.set(cacheKey, html)
    }

    return {
      html,
      fromCache: false,
      fetchedAt: new Date().toISOString(),
      url,
    }
  }

  private async fetchWithRetry(url: string, timeout: number): Promise<string> {
    let lastError: unknown

    for (let attempt = 1; attempt <= HTTP_MAX_RETRIES; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout,
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          },
          responseType: 'text',
        })
        return response.data as string
      } catch (error) {
        lastError = error
        const isServerError =
          axios.isAxiosError(error) &&
          error.response?.status &&
          error.response.status >= 500

        if (!isServerError || attempt === HTTP_MAX_RETRIES) {
          throw error
        }

        const delay = HTTP_RETRY_BASE_DELAY * Math.pow(2, attempt - 1)
        logger.warn('请求失败，重试中', {
          url,
          attempt,
          delay,
          status: (error as { response?: { status?: number } }).response?.status,
        })
        await sleep(delay)
      }
    }

    throw lastError
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
