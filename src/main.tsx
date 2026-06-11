import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/app/App'
import '@/styles/index.css'
import { installApiFetchRewrite } from '@/app/utils/api'
import { initializePersistentStorage } from '@/app/utils/persistentStorage'

installApiFetchRewrite()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

void initializePersistentStorage().catch((error) => {
  console.error('Persistent storage bootstrap failed:', error)
})
