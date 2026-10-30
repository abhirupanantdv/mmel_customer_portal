"""Company contact information and customer-owned ERPNext Issue tickets."""

from __future__ import annotations

from html import escape

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from moneygram.moneygram.api.customer_portal_auth import _customer_for_user


def _clean(value: str, maximum: int) -> str:
	return " ".join((value or "").strip().split())[:maximum]


def _require_customer():
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	user = frappe.get_doc("User", frappe.session.user)
	customer_name = _customer_for_user(user.name)
	if not customer_name:
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)
	return user, frappe.get_doc("Customer", customer_name)


def _company() -> dict:
	company_name = frappe.defaults.get_global_default("company") or frappe.db.get_single_value("Global Defaults", "default_company")
	if not company_name:
		company_name = frappe.db.get_value("Company", {}, "name")
	if not company_name:
		frappe.throw(_("Company support information is not configured."), frappe.ValidationError)
	company = frappe.db.get_value("Company", company_name, ["name", "company_name", "email", "phone_no"], as_dict=True)
	return {
		"name": company.name,
		"company_name": company.company_name or company.name,
		"email": (company.email or "").strip(),
		"phone": (company.phone_no or "").strip(),
	}


def _ticket_dict(row) -> dict:
	resolution = frappe.utils.strip_html(row.resolution_details or "").strip()
	return {
		"name": row.name,
		"subject": row.subject,
		"status": row.status,
		"priority": row.priority,
		"opening_date": row.opening_date,
		"opening_time": row.opening_time,
		"modified": row.modified,
		"resolution": resolution[:2000],
	}


def _my_tickets(user, customer, limit: int = 20) -> list[dict]:
	rows = frappe.get_all(
		"Issue",
		filters={"customer": customer.name, "raised_by": user.email},
		fields=["name", "subject", "status", "priority", "opening_date", "opening_time", "modified", "resolution_details"],
		order_by="modified desc",
		limit_page_length=min(max(int(limit), 1), 100),
		ignore_permissions=True,
	)
	return [_ticket_dict(row) for row in rows]


@frappe.whitelist(methods=["GET"])
def get_support_home() -> dict:
	user, customer = _require_customer()
	priorities = frappe.get_all("Issue Priority", pluck="name", order_by="name asc", limit_page_length=50, ignore_permissions=True)
	return {
		"company": _company(),
		"priorities": priorities or ["Low", "Medium", "High"],
		"tickets": _my_tickets(user, customer),
	}


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=10, seconds=60 * 60)
def create_ticket(subject: str, description: str, priority: str = "Medium", related_reference: str = "") -> dict:
	user, customer = _require_customer()
	subject = _clean(subject, 140)
	description = (description or "").strip()[:4000]
	priority = _clean(priority, 40)
	related_reference = _clean(related_reference, 140)
	if len(subject) < 5:
		frappe.throw(_("Enter a subject of at least 5 characters."), frappe.ValidationError)
	if len(description) < 10:
		frappe.throw(_("Describe how the support team can help."), frappe.ValidationError)
	if not frappe.db.exists("Issue Priority", priority):
		frappe.throw(_("Select a valid ticket priority."), frappe.ValidationError)

	body = escape(description).replace("\n", "<br>")
	if related_reference:
		body += "<br><br><strong>Portal reference:</strong> " + escape(related_reference)
	company = _company()
	values = {
		"doctype": "Issue",
		"subject": subject,
		"description": body,
		"raised_by": user.email,
		"customer": customer.name,
		"company": company["name"],
		"priority": priority,
		"status": "Open",
	}
	if frappe.get_meta("Issue").has_field("via_customer_portal"):
		values["via_customer_portal"] = 1
	doc = frappe.get_doc(values).insert(ignore_permissions=True)
	return _ticket_dict(doc)
