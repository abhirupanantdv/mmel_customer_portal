const normaliseBase = (value: string) => {
  if (!value || value === '/') return ''
  return `/${value.replace(/^\/+|\/+$/g, '')}`
}

export const portalBasePath = normaliseBase(import.meta.env.VITE_PORTAL_BASE_PATH ?? '')

export function assetUrl(path: string) {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${path.replace(/^\/+/, '')}`
}
