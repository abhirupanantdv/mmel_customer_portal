"""Authenticated customer profile and KYC APIs for the customer portal."""

from __future__ import annotations

import os
import re

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import getdate, nowdate, validate_email_address
from frappe.utils.file_manager import save_file

from moneygram.moneygram.api.customer_portal_auth import _customer_for_user


MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
PORTAL_DOCUMENT_TYPES = {
	"PASSPORT": "Passport",
	"DRIVER_LICENCE": "Driver's Licence",
	"VOTER_ID": "Voter ID Card",
	"TIN_EVIDENCE": "TIN Card / TIN Letter / FRCS Joint Card",
	"OFFICIAL_ID": "Government ID",
	"PROOF_OF_ADDRESS": "Proof of Address",
	"CUSTOMER_PHOTO": "Customer Photo",
}
DOCUMENT_OPTIONS = {
	"PROOF_OF_IDENTITY": {
		"label": "Proof of Identity",
		"documents": {
			"PASSPORT": "Passport",
			"TIN_EVIDENCE": "TIN Card / TIN Letter / FRCS Joint Card",
			"VOTER_ID": "Voter ID Card",
			"DRIVER_LICENCE": "Driver's Licence",
			"OFFICIAL_ID": "Government ID",
		},
	},
	"PROOF_OF_ADDRESS": {
		"label": "Proof of Address",
		"documents": {
			"UTILITY_BILL": "Utility Bill",
			"BANK_STATEMENT": "Bank Statement",
			"TENANCY_AGREEMENT": "Tenancy Agreement",
			"GOVERNMENT_LETTER": "Government Letter",
			"OTHER_ADDRESS": "Other Proof of Address",
		},
	},
	"PHOTO": {
		"label": "Photo",
		"documents": {"CUSTOMER_PHOTO": "Customer Photo"},
	},
}
IDENTITY_TYPES = {"PASSPORT", "DRIVER_LICENCE", "VOTER_ID", "TIN_EVIDENCE", "OFFICIAL_ID"}
NUMBER_FIELDS = {
	"PASSPORT": ("Passport", "custom_passport_number"),
	"DRIVER_LICENCE": ("Driver's Licence", "custom_drivers_licence_number"),
	"VOTER_ID": ("Voter ID Card", "custom_voter_id_number"),
	"TIN_EVIDENCE": ("TIN Card", "custom_tin_number"),
}


def _clean(value: str | None, max_length: int) -> str:
	return " ".join((value or "").strip().split())[:max_length]


def _require_customer() -> tuple[frappe.model.document.Document, frappe.model.document.Document]:
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	user = frappe.get_doc("User", frappe.session.user)
	customer_name = _customer_for_user(user.name)
	if not customer_name:
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)
	return user, frappe.get_doc("Customer", customer_name)


def _split_name(full_name: str) -> tuple[str, str, str]:
	parts = full_name.split()
	if len(parts) == 1:
		return parts[0], "", ""
	if len(parts) == 2:
		return parts[0], "", parts[1]
	return parts[0], " ".join(parts[1:-1]), parts[-1]


def _contact_for_user(user: str, customer: str):
	for name in frappe.get_all("Contact", filters={"user": user}, pluck="name", ignore_permissions=True):
		if frappe.db.exists(
			"Dynamic Link",
			{"parent": name, "parenttype": "Contact", "link_doctype": "Customer", "link_name": customer},
		):
			return frappe.get_doc("Contact", name)
	return None


def _address_for_customer(customer: str):
	address_name = frappe.db.get_value(
		"Dynamic Link",
		{"parenttype": "Address", "link_doctype": "Customer", "link_name": customer},
		"parent",
	)
	return frappe.get_doc("Address", address_name) if address_name else None


def _ensure_document_type(code: str) -> None:
	if code not in PORTAL_DOCUMENT_TYPES:
		frappe.throw(_("Unsupported KYC document type."), frappe.ValidationError)


def _selection_for_internal_type(document_type: str) -> tuple[str, str]:
	if document_type in IDENTITY_TYPES:
		return "PROOF_OF_IDENTITY", document_type
	if document_type == "PROOF_OF_ADDRESS":
		return "PROOF_OF_ADDRESS", "OTHER_ADDRESS"
	return "PHOTO", "CUSTOMER_PHOTO"


def _resolve_document_selection(document_category: str, document_name: str) -> tuple[str, str, str]:
	document_category = _clean(document_category, 80).upper()
	document_name = _clean(document_name, 80).upper()
	category = DOCUMENT_OPTIONS.get(document_category)
	if not category or document_name not in category["documents"]:
		frappe.throw(_("Select a valid document type and document name."), frappe.ValidationError)
	internal_type = "PROOF_OF_ADDRESS" if document_category == "PROOF_OF_ADDRESS" else document_name
	return internal_type, category["label"], category["documents"][document_name]


def _evidence_rows(customer: str) -> list[dict]:
	rows = frappe.get_all(
		"Customer Portal KYC Document",
		filters={"customer": customer, "document_type": ["in", list(PORTAL_DOCUMENT_TYPES)]},
		fields=["name", "document_type", "document_category", "document_name", "attachment", "expiry_date", "status", "creation", "modified"],
		order_by="creation desc",
		ignore_permissions=True,
	)
	for row in rows:
		category_code, name_code = _selection_for_internal_type(row.document_type)
		category = DOCUMENT_OPTIONS[category_code]
		row["document_category"] = row.document_category or category_code
		row["category_label"] = category["label"]
		row["document_name"] = row.document_name or category["documents"][name_code]
		row["label"] = row["document_name"]
		row["expired"] = bool(row.expiry_date and getdate(row.expiry_date) < getdate(nowdate()))
	return rows


def _latest_status(rows: list[dict], codes: set[str]) -> str:
	matching = [row for row in rows if row.document_type in codes]
	if not matching:
		return "Not Submitted"
	row = matching[0]
	if row.get("expired"):
		return "Expired"
	return {"Draft": "Under Review", "Verified": "Verified", "Rejected": "Rejected"}.get(row.status, row.status)


def _completion(customer, address, rows: list[dict]) -> int:
	checks = [
		customer.get("custom_full_name"), customer.get("custom_date_of_birth"), customer.get("custom_country"),
		customer.get("custom_occupation"), customer.email_id, customer.mobile_no,
		address and address.address_line1, address and address.city,
		_latest_status(rows, IDENTITY_TYPES) != "Not Submitted",
		_latest_status(rows, {"PROOF_OF_ADDRESS"}) != "Not Submitted",
		_latest_status(rows, {"CUSTOMER_PHOTO"}) != "Not Submitted",
	]
	return round(sum(bool(value) for value in checks) * 100 / len(checks))


@frappe.whitelist(methods=["GET"])
def get_profile() -> dict:
	user, customer = _require_customer()
	contact = _contact_for_user(user.name, customer.name)
	address = _address_for_customer(customer.name)
	rows = _evidence_rows(customer.name)

	identity_status = _latest_status(rows, IDENTITY_TYPES)
	address_status = _latest_status(rows, {"PROOF_OF_ADDRESS"})
	photo_status = _latest_status(rows, {"CUSTOMER_PHOTO"})
	overall_status = "Verified" if {identity_status, address_status, photo_status} == {"Verified"} else "Incomplete"

	return {
		"customer_id": customer.name,
		"account_status": "Active" if not customer.disabled else "Disabled",
		"full_name": customer.get("custom_full_name") or customer.customer_name,
		"date_of_birth": customer.get("custom_date_of_birth"),
		"country": customer.get("custom_country") or (address.country if address else None),
		"city": customer.get("custom_city") or (address.city if address else None),
		"occupation": customer.get("custom_occupation"),
		"email": customer.email_id or user.email,
		"mobile": user.mobile_no or customer.mobile_no,
		"address": {
			"address_line1": address.address_line1 if address else "",
			"address_line2": address.address_line2 if address else "",
			"city": address.city if address else "",
			"state": address.state if address else "",
			"postal_code": address.pincode if address else "",
			"country": address.country if address else (customer.get("custom_country") or "Fiji"),
		},
		"profile_completion": _completion(customer, address, rows),
		"kyc_status": {
			"overall": overall_status,
			"identity": identity_status,
			"address": address_status,
			"photo": photo_status,
		},
		"documents": rows,
		"document_categories": [
			{
				"value": category_code,
				"label": category["label"],
				"documents": [{"value": code, "label": label} for code, label in category["documents"].items()],
			}
			for category_code, category in DOCUMENT_OPTIONS.items()
		],
	}


@frappe.whitelist(methods=["POST"])
def update_profile(
	full_name: str,
	mobile: str,
	date_of_birth: str | None = None,
	country: str = "Fiji",
	city: str = "",
	occupation: str = "",
	address_line1: str = "",
	address_line2: str = "",
	state: str = "",
	postal_code: str = "",
) -> dict:
	user, customer = _require_customer()
	full_name = _clean(full_name, 140)
	mobile = _clean(mobile, 30)
	if len(full_name) < 2:
		frappe.throw(_("Enter your full legal name."), frappe.ValidationError)
	if not re.fullmatch(r"\+?[0-9][0-9 ()-]{6,28}[0-9]", mobile):
		frappe.throw(_("Enter a valid mobile number."), frappe.ValidationError)
	if date_of_birth and getdate(date_of_birth) >= getdate(nowdate()):
		frappe.throw(_("Date of birth must be in the past."), frappe.ValidationError)

	first_name, middle_name, last_name = _split_name(full_name)
	customer.update(
		{
			"customer_name": full_name,
			"custom_first_name": first_name,
			"custom_middle_name": middle_name,
			"custom_last_name": last_name,
			"custom_full_name": full_name,
			"custom_date_of_birth": getdate(date_of_birth) if date_of_birth else None,
			"custom_country": _clean(country, 140),
			"custom_city": _clean(city, 140),
			"custom_occupation": _clean(occupation, 140),
		}
	)
	customer.save(ignore_permissions=True)

	user.update({"first_name": first_name, "middle_name": middle_name, "last_name": last_name, "mobile_no": mobile})
	user.save(ignore_permissions=True)

	contact = _contact_for_user(user.name, customer.name)
	if contact:
		contact.update({"first_name": first_name, "middle_name": middle_name, "last_name": last_name})
		if contact.phone_nos:
			primary = next((row for row in contact.phone_nos if row.is_primary_mobile_no), contact.phone_nos[0])
			primary.phone = mobile
		else:
			contact.append("phone_nos", {"phone": mobile, "is_primary_mobile_no": 1})
		contact.save(ignore_permissions=True)

	address = _address_for_customer(customer.name)
	if address_line1:
		values = {
			"address_title": full_name,
			"address_type": "Personal",
			"address_line1": _clean(address_line1, 240),
			"address_line2": _clean(address_line2, 240),
			"city": _clean(city, 140),
			"state": _clean(state, 140),
			"pincode": _clean(postal_code, 20),
			"country": _clean(country, 140) or "Fiji",
			"phone": mobile,
			"email_id": user.email,
			"is_primary_address": 1,
		}
		if address:
			address.update(values)
			address.save(ignore_permissions=True)
		else:
			address = frappe.get_doc({"doctype": "Address", **values})
			address.append("links", {"link_doctype": "Customer", "link_name": customer.name})
			address.insert(ignore_permissions=True)

	return get_profile()


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=10, seconds=60 * 60)
def upload_kyc_document(
	document_category: str = "",
	document_name: str = "",
	document_type: str = "",
	expiry_date: str | None = None,
	document_number: str = "",
) -> dict:
	_, customer = _require_customer()
	if document_category and document_name:
		document_type, category_label, document_label = _resolve_document_selection(document_category, document_name)
	else:
		document_type = _clean(document_type, 80).upper()
		_ensure_document_type(document_type)
		document_category, document_name = _selection_for_internal_type(document_type)
		category_label = DOCUMENT_OPTIONS[document_category]["label"]
		document_label = PORTAL_DOCUMENT_TYPES[document_type]
	_ensure_document_type(document_type)

	uploaded = frappe.request.files.get("file") if getattr(frappe, "request", None) else None
	if not uploaded or not uploaded.filename:
		frappe.throw(_("Select a document to upload."), frappe.ValidationError)
	extension = os.path.splitext(uploaded.filename.lower())[1]
	if extension not in ALLOWED_EXTENSIONS:
		frappe.throw(_("Only PDF, PNG, JPG, and JPEG files are allowed."), frappe.ValidationError)
	content = uploaded.read()
	if not content or len(content) > MAX_FILE_SIZE:
		frappe.throw(_("The document must be between 1 byte and 10 MB."), frappe.ValidationError)
	if expiry_date and getdate(expiry_date) <= getdate(nowdate()):
		frappe.throw(_("Document expiry must be a future date."), frappe.ValidationError)

	file_doc = save_file(uploaded.filename, content, "Customer", customer.name, is_private=1)
	from moneygram.moneygram.api.customer_portal_membership import ensure_membership

	card = ensure_membership(customer, frappe.session.user)
	evidence = frappe.get_doc(
		{
			"doctype": "Customer Portal KYC Document",
			"customer": customer.name,
			"membership_card": card.name,
			"document_type": document_type,
			"document_category": category_label,
			"document_name": document_label,
			"document_label": document_label,
			"document_number": _clean(document_number, 100),
			"attachment": file_doc.file_url,
			"expiry_date": getdate(expiry_date) if expiry_date else None,
			"status": "Draft",
		}
	).insert(ignore_permissions=True)
	frappe.db.set_value(
		"File",
		file_doc.name,
		{"attached_to_doctype": "Customer Portal KYC Document", "attached_to_name": evidence.name, "attached_to_field": "attachment"},
		update_modified=False,
	)

	if document_type in NUMBER_FIELDS:
		government_id, fieldname = NUMBER_FIELDS[document_type]
		customer.db_set("custom_government_id", government_id, update_modified=False)
		if document_number:
			customer.db_set(fieldname, _clean(document_number, 100), update_modified=False)
		customer.db_set("custom_government_document", file_doc.file_url, update_modified=False)
	elif document_type == "CUSTOMER_PHOTO":
		card.update(
			{
				"photo": file_doc.file_url,
				"profile_review_status": "Pending",
				"card_review_status": "Pending",
			}
		)
		card.save(ignore_permissions=True)

	return get_profile()
