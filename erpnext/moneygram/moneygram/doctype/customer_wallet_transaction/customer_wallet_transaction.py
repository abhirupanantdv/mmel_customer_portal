import frappe
from frappe import _
from frappe.model.document import Document


IMMUTABLE_FIELDS = (
	"wallet", "customer", "portal_user", "transaction_type", "amount", "currency",
	"available_balance_after", "held_balance_after", "reference_doctype", "reference_name",
	"journal_entry", "idempotency_key", "posting_datetime",
)


class CustomerWalletTransaction(Document):
	def validate(self):
		if not self.is_new() and any(self.has_value_changed(field) for field in IMMUTABLE_FIELDS):
			frappe.throw(_("Posted wallet ledger entries are immutable. Create a reversal instead."))

	def on_trash(self):
		frappe.throw(_("Wallet ledger entries cannot be deleted. Create a reversal instead."))
