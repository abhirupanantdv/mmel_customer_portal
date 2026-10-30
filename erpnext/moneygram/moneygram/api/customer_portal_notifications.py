"""Customer-isolated ERPNext Notification Log inbox and status-alert helpers."""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import cint, strip_html

from moneygram.moneygram.api.customer_portal_auth import _customer_for_user


ROUTES = {
	"Customer Forex Request": "/transactions/{name}",
	"Customer Money Transfer Request": "/transactions/{name}",
	"Customer Wallet Request": "/wallet",
	"Customer Portal KYC Document": "/profile/kyc",
	"Customer Membership Card": "/membership-card",
	"Issue": "/support",
}


def _require_portal_user() -> str:
	user = frappe.session.user
	if user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	if not _customer_for_user(user):
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)
	return user


def _route(document_type: str, document_name: str) -> str:
	template = ROUTES.get(document_type or "", "")
	return template.format(name=document_name) if template else ""


def _notification_dict(row) -> dict:
	return {
		"name": row.name,
		"subject": strip_html(row.subject or "").strip()[:500],
		"message": strip_html(row.email_content or "").strip()[:2000],
		"type": row.type or "Alert",
		"document_type": row.document_type or "",
		"document_name": row.document_name or "",
		"read": bool(row.read),
		"creation": row.creation,
		"route": _route(row.document_type, row.document_name),
	}


@frappe.whitelist(methods=["GET"])
def get_notifications(start: int = 0, limit: int = 50) -> dict:
	user = _require_portal_user()
	start = max(cint(start), 0)
	limit = min(max(cint(limit), 1), 100)
	filters = {"for_user": user}
	rows = frappe.get_all(
		"Notification Log",
		filters=filters,
		fields=["name", "subject", "email_content", "type", "document_type", "document_name", "read", "creation"],
		order_by="creation desc",
		start=start,
		page_length=limit,
		ignore_permissions=True,
	)
	return {
		"notifications": [_notification_dict(row) for row in rows],
		"total": frappe.db.count("Notification Log", filters),
		"unread_count": frappe.db.count("Notification Log", {**filters, "read": 0}),
	}


@frappe.whitelist(methods=["GET"])
def get_unread_count() -> dict:
	user = _require_portal_user()
	return {"unread_count": frappe.db.count("Notification Log", {"for_user": user, "read": 0})}


@frappe.whitelist(methods=["POST"])
def mark_read(notification_id: str) -> dict:
	user = _require_portal_user()
	notification_id = (notification_id or "").strip()
	name = frappe.db.get_value("Notification Log", {"name": notification_id, "for_user": user}, "name")
	if not name:
		frappe.throw(_("Notification was not found."), frappe.DoesNotExistError)
	frappe.db.set_value("Notification Log", name, "read", 1, update_modified=False)
	return {"name": name, "read": True}


@frappe.whitelist(methods=["POST"])
def mark_all_read() -> dict:
	user = _require_portal_user()
	names = frappe.get_all(
		"Notification Log",
		filters={"for_user": user, "read": 0},
		pluck="name",
		limit_page_length=500,
		ignore_permissions=True,
	)
	for name in names:
		frappe.db.set_value("Notification Log", name, "read", 1, update_modified=False)
	remaining = frappe.db.count("Notification Log", {"for_user": user, "read": 0})
	return {"updated": len(names), "unread_count": remaining}


def _portal_user(doc) -> str:
	if doc.get("portal_user"):
		return doc.portal_user
	if doc.get("customer"):
		return frappe.db.get_value("Customer Membership Card", {"customer": doc.customer}, "portal_user") or ""
	return ""


def create_portal_notification(for_user: str, subject: str, message: str, document_type: str, document_name: str):
	"""Create a standard ERPNext alert without allowing notification failure to block operations."""
	if not for_user or for_user == "Guest" or not frappe.db.exists("User", {"name": for_user, "enabled": 1}):
		return
	try:
		frappe.get_doc(
			{
				"doctype": "Notification Log",
				"subject": subject[:500],
				"email_content": message[:2000],
				"for_user": for_user,
				"type": "Alert",
				"document_type": document_type,
				"document_name": document_name,
				"from_user": frappe.session.user if frappe.session.user != "Guest" else "Administrator",
			}
		).insert(ignore_permissions=True)
	except Exception:
		frappe.log_error(title="Customer portal notification failed", message=frappe.get_traceback())


def notify_field_change(doc, fieldname: str, label: str):
	previous = doc.get_doc_before_save()
	if not previous:
		return
	old_value = previous.get(fieldname)
	new_value = doc.get(fieldname)
	if not new_value or old_value == new_value:
		return
	create_portal_notification(
		_portal_user(doc),
		_("{0} updated: {1}").format(label, new_value),
		_("Your {0} {1} changed from {2} to {3}.").format(label.lower(), doc.name, old_value or _("Not set"), new_value),
		doc.doctype,
		doc.name,
	)
