import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

from moneygram.moneygram.api.customer_portal_notifications import notify_field_change


class CustomerPortalKYCDocument(Document):
	def before_insert(self):
		self.submitted_on = now_datetime()

	def before_save(self):
		if not self.is_new() and self.has_value_changed("status") and self.status in {"Verified", "Rejected"}:
			self.reviewed_by = frappe.session.user
			self.reviewed_on = now_datetime()

	def on_update(self):
		notify_field_change(self, "status", self.document_name or "KYC document")
