/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

/**
 * 自定义 LLM API 代理插件
 *
 * 开发环境下 chat.ts 会将请求发到 /llm-proxy/chat/completions
 * 并通过 X-Target-Base-URL 头部携带用户配置的真实 baseUrl
 * 本插件读取该头部，将请求转发到真实目标，绕过浏览器 CORS 限制
 *
 * 使用自定义 middleware 而非 Vite 内置 proxy，是因为 Vite 5 内置的
 * http-proxy 版本不支持 router 函数，无法根据请求头动态决定目标
 */
function llmProxyPlugin(): Plugin {
  return {
    name: 'llm-proxy',
    configureServer(server) {
      server.middlewares.use('/llm-proxy', (req, res, next) => {
        if (!req.url) {
          next()
          return
        }

        // 收集请求体
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('error', next)
        req.on('end', () => {
          const targetHeader = req.headers['x-target-base-url'] as string | undefined
          if (!targetHeader) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: { message: 'Missing X-Target-Base-URL header' } }))
            return
          }

          const baseUrl = targetHeader.replace(/\/$/, '')
          let targetUrl: URL
          try {
            // req.url 是去掉 /llm-proxy 前缀后的路径，如 /chat/completions
            targetUrl = new URL(baseUrl + req.url)
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: { message: `Invalid baseUrl: ${baseUrl}` } }))
            return
          }

          // 构造转发请求头：移除自定义头部和与目标主机相关的头部
          const forwardHeaders: Record<string, string | string[]> = {}
          for (const [key, value] of Object.entries(req.headers)) {
            if (value == null) continue
            const lower = key.toLowerCase()
            if (lower === 'x-target-base-url') continue
            if (lower === 'host') continue
            if (lower === 'origin') continue
            if (lower === 'referer') continue
            if (lower === 'connection') continue
            forwardHeaders[key] = value as string | string[]
          }
          // 设置目标 host
          forwardHeaders['host'] = targetUrl.host

          const isHttps = targetUrl.protocol === 'https:'
          const options: http.RequestOptions = {
            method: (req.method || 'POST').toUpperCase() as http.RequestOptions['method'],
            hostname: targetUrl.hostname,
            port: targetUrl.port || (isHttps ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search,
            headers: forwardHeaders,
          }

          const request = isHttps ? https.request : http.request
          const proxyReq = request(options, (proxyRes) => {
            // 透传状态码、响应头和响应体（支持流式 SSE）
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
            proxyRes.pipe(res)
          })

          proxyReq.on('error', (err: NodeJS.ErrnoException) => {
            console.error('[llm-proxy] proxy error:', err.message, 'target=', targetUrl.href)
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(
                JSON.stringify({
                  error: {
                    message: `代理连接失败：${err.message}（目标：${targetUrl.origin}）`,
                  },
                })
              )
            }
          })

          if (chunks.length > 0) {
            proxyReq.write(Buffer.concat(chunks))
          }
          proxyReq.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), llmProxyPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
