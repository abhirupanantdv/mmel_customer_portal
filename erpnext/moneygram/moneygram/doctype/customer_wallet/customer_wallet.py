import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class CustomerWallet(Document):
	def validate(self):
		if flt(self.available_balance) < 0 or flt(self.held_balance) < 0:
			frappe.throw(_("Wallet balances cannot be negative."))
		self.total_balance = flt(self.available_balance, 2) + flt(self.held_balance, 2)

	def on_trash(self):
		if frappe.db.exists("Customer Wallet Transaction", {"wallet": self.name}):
			frappe.throw(_("A wallet with ledger activity cannot be deleted."))
