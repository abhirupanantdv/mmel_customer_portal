import { apiUrl, frappeDownload, frappeRequest } from './auth'

export interface MembershipCardRecord {
  card_number: string
  record_id: string
  status: 'Pending Approval' | 'Active' | 'Rejected'
  profile_review_status: 'Pending' | 'Approved' | 'Rejected'
  card_review_status: 'Pending' | 'Approved' | 'Rejected'
  customer_id: string
  supplier_id: string
  cardholder_name: string
  has_photo: boolean
  photo_data_uri?: string
  submitted_on: string
  issued_on?: string
  valid_until?: string
  operator_remarks?: string
  can_download: boolean
  verification_url?: string
  qr_data_uri?: string
  company_contact: {
    company_name: string
    phone: string
    email: string
    website: string
  }
}

export interface MembershipCardVerification {
  valid: boolean
  status: 'Pending Approval' | 'Active' | 'Rejected'
  card_number: string
  cardholder_name: string
  valid_until?: string
}

const pdfPath = '/api/method/moneygram.moneygram.api.customer_portal_membership.download_card_pdf'

async function preparePhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a PNG or JPEG photograph.')
  const image = await createImageBitmap(file)
  const maximumDimension = 1400
  const scale = Math.min(1, maximumDimension / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not prepare the photograph.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('This browser could not prepare the photograph.')), 'image/jpeg', 0.84)
  })
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'membership-photo'}.jpg`, { type: 'image/jpeg' })
}

export const membershipApi = {
  verifyCard(token: string) {
    return frappeRequest<MembershipCardVerification>(
      `/api/method/moneygram.moneygram.api.customer_portal_membership.verify_card?token=${encodeURIComponent(token)}`,
      { method: 'GET' },
    )
  },

  getCard() {
    return frappeRequest<MembershipCardRecord>(
      '/api/method/moneygram.moneygram.api.customer_portal_membership.get_card',
      { method: 'POST', body: new URLSearchParams() },
    )
  },

  async uploadPhoto(file: File) {
    const preparedPhoto = await preparePhoto(file)
    const body = new FormData()
    body.set('file', preparedPhoto)
    return frappeRequest<MembershipCardRecord>(
      '/api/method/moneygram.moneygram.api.customer_portal_membership.upload_photo',
      { method: 'POST', body },
    )
  },

  async downloadPdf(cardNumber: string) {
    const blob = await frappeDownload(pdfPath)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${cardNumber}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  },

  printPdf() {
    window.open(apiUrl(pdfPath), '_blank', 'noopener,noreferrer')
  },
}
