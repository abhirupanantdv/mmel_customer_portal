import { apiUrl, frappeDownload } from './auth'

export async function downloadRequestReceipt(path: string, filename: string) {
  const blob = await frappeDownload(path)
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export function printRequestReceipt(path: string) {
  window.open(apiUrl(path), '_blank', 'noopener,noreferrer')
}
