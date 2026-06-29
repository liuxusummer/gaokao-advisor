import { describe, expect, it } from 'vitest'
import {
  extractZjRankTableDownload,
  findZjRankTableArticle,
} from '../zhejiang_discovery'

describe('zhejiang rank table discovery', () => {
  it('finds the normal total-score rank table article from jpage XML', () => {
    const xml = `<datastore><recordset>
      <record><![CDATA[
        <li><a href="/art/2026/6/25/art_155_12488.html" title="浙江省2026年高考体育类考生综合分分段表">x</a></li>
      ]]></record>
      <record><![CDATA[
        <li><a href="/art/2026/6/25/art_155_12490.html" title="浙江省2026年普通高校招生成绩分数段表（总分）">x</a></li>
      ]]></record>
      <record><![CDATA[
        <li><a href="/art/2026/6/25/art_155_12491.html" title="浙江省2026年单独考试招生成绩分段表">x</a></li>
      ]]></record>
    </recordset></datastore>`

    expect(findZjRankTableArticle(xml, 2026)).toEqual({
      title: '浙江省2026年普通高校招生成绩分数段表（总分）',
      pageUrl: 'https://www.zjzs.net/art/2026/6/25/art_155_12490.html',
    })
  })

  it('extracts the official PDF download URL from an article page', () => {
    const html = `
      <meta name="ArticleTitle" content="浙江省2026年普通高校招生成绩分数段表（总分）">
      <p><a href="/module/download/downfile.jsp?classid=0&showname=%E6%B5%99%E6%B1%9F%E7%9C%812026%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E6%A0%A1%E6%8B%9B%E7%94%9F%E6%88%90%E7%BB%A9%E5%88%86%E6%95%B0%E6%AE%B5%E8%A1%A8(%E6%80%BB%E5%88%86).pdf&filename=abc123.pdf">浙江省2026年普通高校招生成绩分数段表(总分).pdf</a></p>
    `

    expect(extractZjRankTableDownload(html, 2026)).toEqual({
      title: '浙江省2026年普通高校招生成绩分数段表（总分）',
      pdfUrl: 'https://www.zjzs.net/module/download/downfile.jsp?classid=0&showname=%E6%B5%99%E6%B1%9F%E7%9C%812026%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E6%A0%A1%E6%8B%9B%E7%94%9F%E6%88%90%E7%BB%A9%E5%88%86%E6%95%B0%E6%AE%B5%E8%A1%A8(%E6%80%BB%E5%88%86).pdf&filename=abc123.pdf',
    })
  })
})
