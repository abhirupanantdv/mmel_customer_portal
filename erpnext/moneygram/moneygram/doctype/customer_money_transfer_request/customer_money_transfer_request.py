import re

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, now_datetime

from moneygram.moneygram.api.customer_portal_notifications import notify_field_change


class CustomerMoneyTransferRequest(Document):
	def validate(self):
		self.receive_currency = (self.receive_currency or "").strip().upper()
		self.send_currency = "FJD"
		if not re.fullmatch(r"[A-Z]{3}", self.receive_currency) or self.receive_currency == "FJD":
			frappe.throw(_("Select a valid receiving currency."))
		if flt(self.send_amount) <= 0:
			frappe.throw(_("Send amount must be greater than zero."))
		if not frappe.db.exists(
			"Warehouse",
			{"name": self.warehouse, "is_group": 0, "disabled": 0, "custom_is_vault": 0},
		):
			frappe.throw(_("Select an active branch warehouse."))
		if self.status == "Completed" and not self.money_transfer_reference:
			frappe.throw(_("Enter the completed Money Transfer reference before marking this request Completed."))

	def before_insert(self):
		self.submitted_on = now_datetime()

	def before_save(self):
		if not self.is_new() and self.has_value_changed("status") and frappe.session.user != "Guest":
			self.operator = frappe.session.user
		if self.status == "Completed" and not self.completed_on:
			self.completed_on = now_datetime()

	def on_update(self):
		notify_field_change(self, "status", _("Money transfer request"))
