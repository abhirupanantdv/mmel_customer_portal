import { formBody, frappeRequest } from './auth'

async function prepareCustomerPhoto(file: File): Promise<File> {
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
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'customer-photo'}.jpg`, { type: 'image/jpeg' })
}

export type KycStatus = 'Not Submitted' | 'Under Review' | 'Verified' | 'Rejected' | 'Expired'

export interface DocumentCategoryOption {
  value: string
  label: string
  documents: Array<{ value: string; label: string }>
}

export const DEFAULT_DOCUMENT_CATEGORIES: DocumentCategoryOption[] = [
  { value: 'PROOF_OF_IDENTITY', label: 'Proof of Identity', documents: [
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'TIN_EVIDENCE', label: 'TIN Card / TIN Letter / FRCS Joint Card' },
    { value: 'VOTER_ID', label: 'Voter ID Card' },
    { value: 'DRIVER_LICENCE', label: "Driver's Licence" },
    { value: 'OFFICIAL_ID', label: 'Government ID' },
  ] },
  { value: 'PROOF_OF_ADDRESS', label: 'Proof of Address', documents: [
    { value: 'UTILITY_BILL', label: 'Utility Bill' },
    { value: 'BANK_STATEMENT', label: 'Bank Statement' },
    { value: 'TENANCY_AGREEMENT', label: 'Tenancy Agreement' },
    { value: 'GOVERNMENT_LETTER', label: 'Government Letter' },
    { value: 'OTHER_ADDRESS', label: 'Other Proof of Address' },
  ] },
  { value: 'PHOTO', label: 'Photo', documents: [{ value: 'CUSTOMER_PHOTO', label: 'Customer Photo' }] },
]

export interface KycDocument {
  name: string
  document_type: string
  document_category: string
  category_label: string
  document_name: string
  label: string
  attachment: string
  expiry_date?: string
  status: 'Draft' | 'Verified' | 'Rejected'
  creation: string
  modified: string
  expired: boolean
}

export interface CustomerProfile {
  customer_id: string
  account_status: 'Active' | 'Disabled'
  full_name: string
  date_of_birth?: string
  country?: string
  city?: string
  occupation?: string
  email: string
  mobile?: string
  address: {
    address_line1: string
    address_line2: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  profile_completion: number
  kyc_status: {
    overall: 'Verified' | 'Incomplete'
    identity: KycStatus
    address: KycStatus
    photo: KycStatus
  }
  documents: KycDocument[]
  document_categories?: DocumentCategoryOption[]
}

export interface ProfileUpdate {
  full_name: string
  mobile: string
  date_of_birth?: string
  country: string
  city: string
  occupation: string
  address_line1: string
  address_line2: string
  state: string
  postal_code: string
}

export const profileApi = {
  getProfile() {
    return frappeRequest<CustomerProfile>(
      '/api/method/moneygram.moneygram.api.customer_portal_profile.get_profile',
      { method: 'GET' },
    )
  },

  updateProfile(values: ProfileUpdate) {
    return frappeRequest<CustomerProfile>(
      '/api/method/moneygram.moneygram.api.customer_portal_profile.update_profile',
      { method: 'POST', body: formBody(values) },
    )
  },

  async uploadDocument(values: { document_category: string; document_name: string; document_number?: string; expiry_date?: string; file: File }) {
    const body = new FormData()
    body.set('document_category', values.document_category)
    body.set('document_name', values.document_name)
    if (values.document_number) body.set('document_number', values.document_number)
    if (values.expiry_date) body.set('expiry_date', values.expiry_date)
    body.set('file', values.document_category === 'PHOTO' ? await prepareCustomerPhoto(values.file) : values.file)
    return frappeRequest<CustomerProfile>(
      '/api/method/moneygram.moneygram.api.customer_portal_profile.upload_kyc_document',
      { method: 'POST', body },
    )
  },
}
