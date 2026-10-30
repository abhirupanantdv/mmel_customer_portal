import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, now_datetime

from moneygram.moneygram.api.customer_portal_notifications import notify_field_change


class CustomerWalletRequest(Document):
	def before_insert(self):
		self.submitted_on = now_datetime()

	def validate(self):
		if self.request_type not in {"Funding", "Withdrawal"}:
			frappe.throw(_("Select a valid wallet request type."))
		if flt(self.amount) <= 0:
			frappe.throw(_("Request amount must be greater than zero."))
		if not self.is_new() and self.has_value_changed("status") and self.status == "Completed" and not self.wallet_transaction:
			frappe.throw(_("Use the Approve and Post action to complete this request."))

	def on_update(self):
		notify_field_change(self, "status", _("Wallet request"))
