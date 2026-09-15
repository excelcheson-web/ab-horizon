export const deliveries = []
export let failDelivery = false
export function setDeliveryFailure(value) { failDelivery = value }
export default {
  init() {},
  async send(service, template, params) {
    if (failDelivery) throw new Error('Test email delivery failure')
    deliveries.push(params)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('test-email', { detail: params }))
    }
    return { status: 200 }
  },
}
