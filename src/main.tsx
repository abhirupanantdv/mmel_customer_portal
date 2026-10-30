import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles.css'
import { assetUrl, portalBasePath } from './utils/assets'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })
document.documentElement.style.setProperty('--membership-card-front-image', `url("${assetUrl('assets/membership-card-front-template.png')}")`)
document.documentElement.style.setProperty('--membership-card-back-image', `url("${assetUrl('assets/membership-card-back-template.png')}")`)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={portalBasePath}><App /></BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
