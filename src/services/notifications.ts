import { formBody, frappeRequest } from './auth'

export interface PortalNotification {
  name: string
  subject: string
  message: string
  type: string
  document_type: string
  document_name: string
  read: boolean
  creation: string
  route: string
}

export interface NotificationInbox {
  notifications: PortalNotification[]
  total: number
  unread_count: number
}

const method = '/api/method/moneygram.moneygram.api.customer_portal_notifications'

export const notificationApi = {
  list(start = 0, limit = 50) {
    return frappeRequest<NotificationInbox>(`${method}.get_notifications?start=${start}&limit=${limit}`, { method: 'GET' })
  },

  unreadCount() {
    return frappeRequest<{ unread_count: number }>(`${method}.get_unread_count`, { method: 'GET' })
  },

  markRead(notificationId: string) {
    return frappeRequest<{ name: string; read: boolean }>(`${method}.mark_read`, {
      method: 'POST', body: formBody({ notification_id: notificationId }),
    })
  },

  markAllRead() {
    return frappeRequest<{ updated: number; unread_count: number }>(`${method}.mark_all_read`, {
      method: 'POST', body: new URLSearchParams(),
    })
  },
}
