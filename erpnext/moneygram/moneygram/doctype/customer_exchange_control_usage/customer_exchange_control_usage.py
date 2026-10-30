import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from moneygram.moneygram.api.customer_portal_limits import RULES_BY_CODE
from moneygram.moneygram.api.customer_portal_auth import _customer_for_user


class CustomerExchangeControlUsage(Document):
	def validate(self):
		rule = RULES_BY_CODE.get((self.rule_code or "").strip())
		if not rule:
			frappe.throw(_("Select a valid 2026 exchange-control rule code."))
		if flt(self.amount_fjd) <= 0:
			frappe.throw(_("The FJD usage amount must be greater than zero."))
		if self.source_doctype and not self.source_name:
			frappe.throw(_("Select the source record."))
		if self.source_name and not self.source_doctype:
			frappe.throw(_("Select the source DocType."))
		if _customer_for_user(self.portal_user) != self.customer:
			frappe.throw(_("The portal user must belong to the selected customer."))
		self.rule_code = rule["code"]
		self.rule_label = rule["label"]
		if self.is_new():
			self.operator = frappe.session.user

	def on_trash(self):
		if self.usage_state == "Completed":
			frappe.throw(_("Completed exchange-control usage cannot be deleted. Mark a correcting entry instead."))
