import { PDFParse } from 'pdf-parse'
import { createLogger } from './logger'

const logger = createLogger('pdf')

export async function parsePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    logger.info('PDF 解析完成', { textLength: result.text.length })
    return result.text
  } catch (error) {
    logger.error('PDF 解析失败', { error: (error as Error).message })
    throw new Error(`PDF 解析失败: ${(error as Error).message}`, { cause: error })
  } finally {
    await parser.destroy()
  }
}
