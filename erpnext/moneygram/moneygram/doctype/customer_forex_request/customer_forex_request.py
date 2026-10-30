import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, now_datetime

from moneygram.moneygram.api.customer_portal_notifications import notify_field_change


class CustomerForexRequest(Document):
	def validate(self):
		self.request_type = (self.request_type or "").upper()
		self.foreign_currency = (self.foreign_currency or "").upper()
		if self.request_type not in {"BUY", "SELL"}:
			frappe.throw(_("Request type must be BUY or SELL."))
		if flt(self.foreign_amount) <= 0 or flt(self.exchange_rate) <= 0:
			frappe.throw(_("Foreign amount and exchange rate must be greater than zero."))
		if not frappe.db.exists("Warehouse", {"name": self.warehouse, "is_group": 0, "disabled": 0, "custom_is_vault": 0}):
			frappe.throw(_("Select an active branch warehouse."))
		if self.currency_exchange:
			linked = frappe.get_doc("Currency Exchange For Customer", self.currency_exchange)
			if linked.customer_id != self.customer or linked.warehouse != self.warehouse:
				frappe.throw(_("The completed exchange must belong to the same customer and branch."))
			expected_exchange_type = "SELL" if self.request_type == "BUY" else "BUY"
			if linked.exchange_type != expected_exchange_type:
				frappe.throw(_("The completed exchange type does not match this customer request."))
		if self.status == "Completed" and not self.currency_exchange:
			frappe.throw(_("Link the completed Currency Exchange before marking this request Completed."))

	def before_insert(self):
		self.submitted_on = now_datetime()

	def before_save(self):
		if not self.is_new() and self.has_value_changed("status") and frappe.session.user != "Guest":
			self.operator = frappe.session.user
		if self.status == "Completed" and not self.completed_on:
			self.completed_on = now_datetime()

	def on_update(self):
		notify_field_change(self, "status", _("Foreign exchange request"))
