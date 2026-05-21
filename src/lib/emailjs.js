/**
 * emailjs.js — EmailJS browser SDK wrapper for Optima Credit Union
 *
 * Required .env variables:
 *   VITE_EMAILJS_SERVICE_ID
 *   VITE_EMAILJS_PUBLIC_KEY
 *   VITE_EMAILJS_TEMPLATE_CONTACT   (contact_request)
 *   VITE_EMAILJS_TEMPLATE_SUPPORT   (support_request)
 *   VITE_EMAILJS_TEMPLATE_SECURITY  (security_report)
 *   VITE_EMAILJS_TEMPLATE_NEWACCOUNT  (new_account_request)
 */
import emailjs from '@emailjs/browser'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export const TEMPLATES = {
  contact:  import.meta.env.VITE_EMAILJS_TEMPLATE_CONTACT  || 'contact_request',
  support:  import.meta.env.VITE_EMAILJS_TEMPLATE_SUPPORT  || 'support_request',
  security: import.meta.env.VITE_EMAILJS_TEMPLATE_SECURITY || 'security_report',
  newacct:  import.meta.env.VITE_EMAILJS_TEMPLATE_NEWACCOUNT || 'new_account_request',
}

export function isEmailJSConfigured() {
  return !!(SERVICE_ID && PUBLIC_KEY)
}

/**
 * Send via form ref — EmailJS maps input[name] attributes to template variables.
 * @param {string} templateId - one of TEMPLATES.*
 * @param {React.RefObject} formRef - ref to the <form> element
 */
export function sendForm(templateId, formRef) {
  if (!isEmailJSConfigured()) {
    return Promise.reject(
      new Error('EmailJS not configured. Add VITE_EMAILJS_SERVICE_ID and VITE_EMAILJS_PUBLIC_KEY to your .env file.')
    )
  }
  return emailjs.sendForm(SERVICE_ID, templateId, formRef.current, PUBLIC_KEY)
}

/**
 * Send via plain data object (no form ref needed).
 * @param {string} templateId - one of TEMPLATES.*
 * @param {Object} data - key/value pairs matching template variables
 */
export function sendData(templateId, data) {
  if (!isEmailJSConfigured()) {
    return Promise.reject(
      new Error('EmailJS not configured. Add VITE_EMAILJS_SERVICE_ID and VITE_EMAILJS_PUBLIC_KEY to your .env file.')
    )
  }
  return emailjs.send(SERVICE_ID, templateId, data, PUBLIC_KEY)
}
