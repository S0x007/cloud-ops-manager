/** S3 / OBS 对象预览内容分类（main 进程使用） */

export type ObjectPreviewContent =
  | { type: 'text'; contentType: string; content: string; size: number }
  | { type: 'image'; contentType: string; base64: string; size: number }
  | { type: 'binary'; contentType: string; size: number }

const TEXT_TYPES = [
  'text/', 'application/json', 'application/xml', 'application/javascript',
  'application/x-yaml', 'application/x-sh', 'application/x-shellscript',
  'application/x-httpd-php', 'text/yaml', 'text/x-yaml',
]

const TEXT_EXTENSIONS = [
  '.txt', '.json', '.xml', '.yaml', '.yml', '.sh', '.bash',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp',
  '.h', '.hpp', '.css', '.scss', '.less', '.html', '.htm', '.md', '.csv', '.log',
  '.env', '.conf', '.ini', '.cfg', '.toml', '.sql', '.php', '.pl', '.swift',
  '.gradle', '.properties', '.dockerfile', '.gitignore', '.editorconfig',
]

const IMAGE_EXTENSIONS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
}

const MAX_TEXT_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

/** data URL 用，去掉 charset 等参数避免浏览器无法解析 */
export function normalizePreviewMime(contentType: string): string {
  return contentType.split(';')[0].trim() || 'application/octet-stream'
}

export function toPreviewDataUrl(contentType: string, base64: string): string {
  return `data:${normalizePreviewMime(contentType)};base64,${base64}`
}

function detectImageMime(data: Buffer, keyLower: string, contentType: string): string | undefined {
  if (contentType.startsWith('image/')) return normalizePreviewMime(contentType)
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return 'image/png'
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg'
  }
  if (data.length >= 4 && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    return 'image/gif'
  }
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp'
  }
  if (data.length >= 2 && data[0] === 0x42 && data[1] === 0x4d) {
    return 'image/bmp'
  }
  return Object.entries(IMAGE_EXTENSIONS).find(([ext]) => keyLower.endsWith(ext))?.[1]
}

export function classifyObjectPreview(
  data: Buffer,
  contentType: string,
  objectKey: string,
): ObjectPreviewContent {
  const keyLower = objectKey.toLowerCase()
  const imageContentType = detectImageMime(data, keyLower, contentType)

  if (imageContentType && data.length < MAX_IMAGE_BYTES) {
    return {
      type: 'image',
      contentType: imageContentType,
      base64: data.toString('base64'),
      size: data.length,
    }
  }

  const isText = TEXT_TYPES.some((t) => contentType.startsWith(t)) ||
    TEXT_EXTENSIONS.some((ext) => keyLower.endsWith(ext)) ||
    contentType === 'application/json'

  if (isText && data.length < MAX_TEXT_BYTES) {
    return {
      type: 'text',
      contentType,
      content: data.toString('utf-8'),
      size: data.length,
    }
  }

  return {
    type: 'binary',
    contentType,
    size: data.length,
  }
}
