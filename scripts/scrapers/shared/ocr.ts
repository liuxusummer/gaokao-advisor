import { createWorker } from 'tesseract.js'
import { createLogger } from './logger'

const logger = createLogger('ocr')

/**
 * 对图片 Buffer 进行 OCR 识别，返回识别文本。
 * 使用 tesseract.js + chi_sim 中文简体语言包。
 */
export async function ocrImage(
  buffer: Buffer,
  lang: string = 'chi_sim'
): Promise<string> {
  logger.info('开始 OCR 识别', { lang, bufferSize: buffer.length })

  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        logger.info('OCR 进度', { progress: `${Math.round(m.progress * 100)}%` })
      }
    },
  })

  try {
    const { data: { text } } = await worker.recognize(buffer)
    logger.info('OCR 识别完成', { textLength: text.length })
    return text
  } catch (error) {
    logger.error('OCR 识别失败', { error: (error as Error).message })
    throw new Error(`OCR 识别失败: ${(error as Error).message}`, { cause: error })
  } finally {
    await worker.terminate()
  }
}
