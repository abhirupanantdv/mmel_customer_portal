import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import add_years, now_datetime, nowdate

from moneygram.moneygram.api.customer_portal_notifications import notify_field_change


IDENTITY_TYPES = {"PASSPORT", "DRIVER_LICENCE", "VOTER_ID", "TIN_EVIDENCE", "OFFICIAL_ID"}
CARD_NUMBER_SERIES = "MHC-CARD-.############"


def generate_card_number() -> str:
	sequence = make_autoname(CARD_NUMBER_SERIES).rsplit("-", 1)[-1]
	return f"6234{sequence}"


def normalise_card_number(card_number: str | None) -> str:
	"""Preserve legacy card identity while expanding 12-digit numbers to 16 digits."""
	card_number = (card_number or "").strip()
	if card_number.isdigit() and len(card_number) == 16 and card_number.startswith("6234"):
		return card_number
	if card_number.isdigit() and len(card_number) == 12 and card_number.startswith("6234"):
		return f"{card_number[:4]}0000{card_number[4:]}"
	return generate_card_number()


def _has_verified_evidence(customer: str, document_types: set[str]) -> bool:
	return bool(
		frappe.db.exists(
			"Customer Portal KYC Document",
			{"customer": customer, "document_type": ["in", list(document_types)], "status": "Verified"},
		)
	)


class CustomerMembershipCard(Document):
	def before_insert(self):
		if not self.card_number:
			self.card_number = generate_card_number()
		if not self.verification_token:
			self.verification_token = frappe.generate_hash(length=32)
		self.submitted_on = now_datetime()

	def validate(self):
		if not (self.card_number or "").isdigit() or len(self.card_number) != 16 or not self.card_number.startswith("6234"):
			frappe.throw(_("The membership card number must contain 16 digits and start with 6234."))
		if self.customer != self.supplier:
			frappe.throw(_("Customer and Supplier IDs must be the same for a portal member."))

		if self.profile_review_status == "Approved":
			missing = []
			if not _has_verified_evidence(self.customer, IDENTITY_TYPES):
				missing.append(_("identity document"))
			if not _has_verified_evidence(self.customer, {"PROOF_OF_ADDRESS"}):
				missing.append(_("proof of address"))
			if not _has_verified_evidence(self.customer, {"CUSTOMER_PHOTO"}):
				missing.append(_("customer photograph"))
			if missing:
				frappe.throw(_("Verify the following KYC evidence before approving the profile: {0}.").format(", ".join(missing)))

		if self.card_review_status == "Approved" and self.profile_review_status != "Approved":
			frappe.throw(_("Approve the customer profile before approving the membership card."))
		if self.card_review_status == "Approved" and not self.photo:
			frappe.throw(_("A verified customer photograph is required before approving the card."))

		if "Rejected" in {self.profile_review_status, self.card_review_status}:
			self.status = "Rejected"
		elif {self.profile_review_status, self.card_review_status} == {"Approved"}:
			self.status = "Active"
			if not self.issued_on:
				self.issued_on = nowdate()
			if not self.valid_until:
				self.valid_until = add_years(self.issued_on, 2)
			if not self.approved_on:
				self.approved_on = now_datetime()
			if not self.approved_by:
				self.approved_by = frappe.session.user
		else:
			self.status = "Pending Approval"

	def on_update(self):
		notify_field_change(self, "profile_review_status", _("Profile verification"))
		notify_field_change(self, "card_review_status", _("Membership card review"))
