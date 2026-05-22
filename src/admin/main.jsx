import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../style.css'
import AdminAuth from './AdminAuth.jsx'

createRoot(document.getElementById('admin-root')).render(
  <StrictMode>
    <AdminAuth />
  </StrictMode>,
)
