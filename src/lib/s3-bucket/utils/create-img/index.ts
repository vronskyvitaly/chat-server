import { PutObjectCommand } from '@aws-sdk/client-s3'
import { S3 } from '../../instanse'
import { removeAllSpacesInString } from '../../../string/remove-all-spaces-in-string'

// Новый тип — совместимый с сервером
interface ServerFile {
  buffer: Buffer
  originalname: string
  mimetype: string
}

// Максимальный размер: например, 10 МБ
const MAX_FILE_SIZE = 10 * 1024 * 1024 // байты

export const createImgInBucket = async (folderPath: string, file: File | ServerFile) => {
  try {
    // Определяем, браузерный ли это File
    const isBrowserFile = 'arrayBuffer' in file && typeof file.arrayBuffer === 'function'

    let buffer: Buffer
    let name: string
    let type: string
    let size: number

    if (isBrowserFile) {
      // Браузерный File
      const arrayBuffer = await (file as File).arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
      name = (file as File).name
      type = (file as File).type
      size = buffer.byteLength
    } else {
      // Серверный файл (Node.js)
      buffer = (file as ServerFile).buffer
      name = (file as ServerFile).originalname
      type = (file as ServerFile).mimetype
      size = buffer.byteLength
    }

    // ✅ Проверка размера файла
    if (size > MAX_FILE_SIZE) {
      return { resCode: 500, url: '', error: 'File size is too large.' }
    }

    // Генерируем безопасное имя файла
    const newFileName = `${crypto.randomUUID()}-${removeAllSpacesInString(name)}`
    const bucketName = process.env.S3_BASKET_NAME as string
    const fullKey = `${folderPath}/${newFileName}`

    const res = await S3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fullKey,
        ACL: 'public-read-write',
        Body: buffer,
        ContentType: type
      })
    )

    if (res.$metadata.httpStatusCode === 200) {
      console.log('Добавлено в S3')
    }

    const url = `https://storage.yandexcloud.net/${bucketName}/${fullKey}`
    return { resCode: 200, url, error: '' }
  } catch (e) {
    console.error('S3 Upload Error:', e)
    return { resCode: 400, url: '', error: 'User image not saved to S3' }
  }
}
