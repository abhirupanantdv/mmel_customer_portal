"""Customer portal authentication endpoints for the Moneygram app."""

from __future__ import annotations

import re
from datetime import date

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import getdate, validate_email_address


CUSTOMER_ROLE = "Customer"
DEFAULT_CUSTOMER_GROUP = "Individual"
DEFAULT_TERRITORY = "Fiji"


def _clean(value: str | None, max_length: int) -> str:
	return " ".join((value or "").strip().split())[:max_length]


def _split_name(full_name: str) -> tuple[str, str, str]:
	parts = full_name.split()
	if len(parts) == 1:
		return parts[0], "", ""
	if len(parts) == 2:
		return parts[0], "", parts[1]
	return parts[0], " ".join(parts[1:-1]), parts[-1]


def _validate_date_of_birth(value: str | None) -> date | None:
	if not value:
		return None

	birth_date = getdate(value)
	if birth_date >= getdate():
		frappe.throw(_("Date of birth must be in the past."), frappe.ValidationError)
	return birth_date


def _validate_mobile(value: str | None) -> str:
	mobile = _clean(value, 30)
	if not mobile or not re.fullmatch(r"\+?[0-9][0-9 ()-]{6,28}[0-9]", mobile):
		frappe.throw(_("Enter a valid mobile number."), frappe.ValidationError)
	return mobile


def _ensure_reference_data() -> None:
	if not frappe.db.exists("Role", CUSTOMER_ROLE):
		frappe.throw(_("The Customer role is not configured."), frappe.ValidationError)
	if not frappe.db.exists("Customer Group", DEFAULT_CUSTOMER_GROUP):
		frappe.throw(_("The Individual customer group is not configured."), frappe.ValidationError)
	if not frappe.db.exists("Territory", DEFAULT_TERRITORY):
		frappe.throw(_("The Fiji territory is not configured."), frappe.ValidationError)


@frappe.whitelist(allow_guest=True, methods=["POST"])
@rate_limit(limit=5, seconds=60 * 60)
def sign_up(
	full_name: str,
	email: str,
	password: str,
	mobile: str,
	date_of_birth: str | None = None,
	country: str = DEFAULT_TERRITORY,
	consent: int | str = 0,
) -> dict:
	"""Create a portal User plus matching Customer, Supplier, Contact, and membership card."""
	if str(consent).lower() not in {"1", "true", "yes"}:
		frappe.throw(_("You must accept the terms and privacy notice."), frappe.ValidationError)

	full_name = _clean(full_name, 140)
	if len(full_name) < 2:
		frappe.throw(_("Enter your full legal name."), frappe.ValidationError)

	email = (email or "").strip().lower()
	validate_email_address(email, throw=True)
	mobile = _validate_mobile(mobile)
	birth_date = _validate_date_of_birth(date_of_birth)
	country = _clean(country, 140) or DEFAULT_TERRITORY

	if frappe.db.exists("User", email):
		frappe.throw(_("An account already exists for this email address."), frappe.DuplicateEntryError)

	_ensure_reference_data()
	first_name, middle_name, last_name = _split_name(full_name)

	customer = frappe.get_doc(
		{
			"doctype": "Customer",
			"customer_name": full_name,
			"customer_type": "Individual",
			"customer_group": DEFAULT_CUSTOMER_GROUP,
			"territory": DEFAULT_TERRITORY,
			"custom_first_name": first_name,
			"custom_middle_name": middle_name,
			"custom_last_name": last_name,
			"custom_full_name": full_name,
			"custom_date_of_birth": birth_date,
			"custom_country": country,
		}
	).insert(ignore_permissions=True)

	user = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": first_name,
			"middle_name": middle_name,
			"last_name": last_name,
			"mobile_no": mobile,
			"enabled": 1,
			"user_type": "Website User",
			"send_welcome_email": 0,
			"new_password": password,
		}
	)
	user.flags.ignore_permissions = True
	user.insert()
	user.add_roles(CUSTOMER_ROLE)

	contact = frappe.get_doc(
		{
			"doctype": "Contact",
			"first_name": first_name,
			"middle_name": middle_name,
			"last_name": last_name,
			"user": user.name,
			"is_primary_contact": 1,
		}
	)
	contact.append("email_ids", {"email_id": email, "is_primary": 1})
	contact.append("phone_nos", {"phone": mobile, "is_primary_mobile_no": 1})
	contact.append("links", {"link_doctype": "Customer", "link_name": customer.name})
	contact.insert(ignore_permissions=True)

	customer.db_set("customer_primary_contact", contact.name, update_modified=False)

	from moneygram.moneygram.api.customer_portal_membership import create_membership_for_signup

	card = create_membership_for_signup(customer, user.name)
	if not frappe.db.exists(
		"Dynamic Link",
		{"parent": contact.name, "parenttype": "Contact", "link_doctype": "Supplier", "link_name": card.supplier},
	):
		contact.append("links", {"link_doctype": "Supplier", "link_name": card.supplier})
		contact.save(ignore_permissions=True)

	return {
		"customer_id": customer.name,
		"supplier_id": card.supplier,
		"membership_card": card.name,
		"email": email,
		"full_name": full_name,
		"message": _("Account created successfully. Sign in to complete your profile and submit documents for approval."),
	}


def _customer_for_user(user: str) -> str | None:
	contacts = frappe.get_all("Contact", filters={"user": user}, pluck="name", ignore_permissions=True)
	contacts.extend(
		frappe.get_all(
			"Contact Email",
			filters={"email_id": user, "parenttype": "Contact"},
			pluck="parent",
			ignore_permissions=True,
		)
	)
	for contact in dict.fromkeys(contacts):
		customer = frappe.db.get_value(
			"Dynamic Link",
			{"parent": contact, "parenttype": "Contact", "link_doctype": "Customer"},
			"link_name",
		)
		if customer:
			return customer
	return None


@frappe.whitelist(methods=["GET"])
def me() -> dict:
	"""Return the authenticated portal user's linked customer identity."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)

	user = frappe.get_doc("User", frappe.session.user)
	customer_name = _customer_for_user(user.name)
	if not customer_name:
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)

	customer = frappe.get_doc("Customer", customer_name)
	return {
		"user": user.name,
		"customer_id": customer.name,
		"full_name": customer.get("custom_full_name") or customer.customer_name,
		"email": customer.email_id or user.email,
		"mobile": customer.mobile_no or user.mobile_no,
		"date_of_birth": customer.get("custom_date_of_birth"),
		"country": customer.get("custom_country"),
	}
