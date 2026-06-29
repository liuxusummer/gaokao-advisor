const ZJZS_ORIGIN = 'https://www.zjzs.net'
const ZJZS_NEWS_COLUMN_ID = 155
const ZJZS_NEWS_UNIT_ID = 501
const PAGE_SIZE = 12
const GROUP_SIZE = 3

export interface ZjRankTableArticle {
  title: string
  pageUrl: string
}

export interface ZjRankTableDownload {
  title: string
  pdfUrl: string
}

export interface ZjRankTableSource extends ZjRankTableArticle {
  pdfUrl: string
}

export function findZjRankTableArticle(xml: string, year: number): ZjRankTableArticle | undefined {
  const records = [...xml.matchAll(/<record><!\[CDATA\[([\s\S]*?)\]\]><\/record>/g)]
    .map((match) => match[1])

  for (const record of records) {
    const title = decodeHtmlAttribute(record.match(/title="([^"]+)"/)?.[1] ?? '')
    const href = decodeHtmlAttribute(record.match(/href="([^"]+)"/)?.[1] ?? '')
    if (!title || !href) continue

    if (isNormalTotalRankTableTitle(title, year)) {
      return {
        title,
        pageUrl: absolutizeZjzsUrl(href),
      }
    }
  }

  return undefined
}

export function extractZjRankTableDownload(
  html: string,
  year: number
): ZjRankTableDownload | undefined {
  const title = decodeHtmlAttribute(
    html.match(/<meta\s+name="ArticleTitle"\s+content="([^"]+)"/)?.[1] ?? ''
  )
  if (!isNormalTotalRankTableTitle(title, year)) return undefined

  const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) =>
    decodeHtmlAttribute(match[1])
  )
  const pdfUrl = links.find((href) =>
    href.includes('/module/download/downfile.jsp') &&
    /filename=[^&]+\.pdf/i.test(href) &&
    decodeURIComponentSafe(href).includes(`${year}年普通高校招生成绩分数段表`)
  )

  if (!pdfUrl) return undefined

  return {
    title,
    pdfUrl: absolutizeZjzsUrl(pdfUrl),
  }
}

export async function discoverZjRankTableSource(
  year: number,
  options: { maxGroups?: number } = {}
): Promise<ZjRankTableSource | undefined> {
  const maxGroups = options.maxGroups ?? 3

  for (let group = 0; group < maxGroups; group++) {
    const startRecord = group * PAGE_SIZE * GROUP_SIZE + 1
    const endRecord = startRecord + PAGE_SIZE * GROUP_SIZE - 1
    const xml = await fetchZjzsNewsGroup(startRecord, endRecord)
    const article = findZjRankTableArticle(xml, year)
    if (!article) continue

    const pageHtml = await fetchText(article.pageUrl)
    const download = extractZjRankTableDownload(pageHtml, year)
    if (!download) return undefined

    return {
      ...article,
      pdfUrl: download.pdfUrl,
    }
  }

  return undefined
}

async function fetchZjzsNewsGroup(startRecord: number, endRecord: number): Promise<string> {
  const params = new URLSearchParams({
    col: '1',
    webid: '1',
    path: '/',
    columnid: String(ZJZS_NEWS_COLUMN_ID),
    sourceContentType: '1',
    unitid: String(ZJZS_NEWS_UNIT_ID),
    webname: '浙江省教育考试院官网',
    permissiontype: '0',
  })
  const url =
    `${ZJZS_ORIGIN}/module/web/jpage/dataproxy.jsp` +
    `?startrecord=${startRecord}&endrecord=${endRecord}&perpage=${PAGE_SIZE}`

  return fetchText(url, {
    method: 'POST',
    body: params,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${url}`)
  }
  return response.text()
}

function isNormalTotalRankTableTitle(title: string, year: number): boolean {
  return (
    title.includes(`浙江省${year}年普通高校招生成绩分数段表`) &&
    title.includes('总分') &&
    !title.includes('单独考试') &&
    !title.includes('体育') &&
    !title.includes('艺术')
  )
}

function absolutizeZjzsUrl(url: string): string {
  return new URL(url, ZJZS_ORIGIN).toString()
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
