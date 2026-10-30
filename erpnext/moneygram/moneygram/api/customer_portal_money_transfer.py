"""Customer portal money-transfer options and request submission."""

from __future__ import annotations

import re

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import flt, format_datetime
from frappe.utils.pdf import get_pdf

from moneygram.moneygram.api.customer_portal_auth import _customer_for_user


def _require_customer():
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	customer = _customer_for_user(frappe.session.user)
	if not customer:
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)
	return frappe.get_doc("Customer", customer)


def _active_branch(warehouse: str) -> bool:
	return bool(
		frappe.db.exists(
			"Warehouse",
			{"name": warehouse, "is_group": 0, "disabled": 0, "custom_is_vault": 0},
		)
	)


def _destination_rows() -> list[dict]:
	"""Derive destination countries and currencies only from enabled denomination Items."""
	items = frappe.get_all(
		"Item",
		filters={"disabled": 0, "custom_attribute_value": [">", 0]},
		fields=["name", "item_code", "item_group"],
		order_by="item_group asc, item_code asc",
		limit_page_length=5000,
		ignore_permissions=True,
	)
	destinations = {}
	for item in items:
		code_match = re.match(r"^([A-Za-z]{3})(?:\s|$)", (item.item_code or item.name or "").strip())
		country = (item.item_group or "").strip()
		if not code_match or not country:
			continue
		currency = code_match.group(1).upper()
		if currency == "FJD":
			continue
		destinations[(country, currency)] = {
			"country": country,
			"currency": currency,
			"source_item": item.name,
		}
	return sorted(destinations.values(), key=lambda row: (row["country"], row["currency"]))


def _validate_destination(country: str, currency: str) -> tuple[str, str]:
	country = (country or "").strip()
	currency = (currency or "").strip().upper()
	if not country or not re.fullmatch(r"[A-Z]{3}", currency) or currency == "FJD":
		frappe.throw(_("Select a valid destination country."), frappe.ValidationError)
	if not any(row["country"] == country and row["currency"] == currency for row in _destination_rows()):
		frappe.throw(_("This destination is not available from the configured Items."), frappe.ValidationError)
	return country, currency


def _owned_request(request_id: str):
	customer = _require_customer()
	request_id = (request_id or "").strip()
	if not request_id:
		frappe.throw(_("Request ID is required."), frappe.ValidationError)
	doc = frappe.get_doc("Customer Money Transfer Request", request_id)
	if doc.customer != customer.name or doc.portal_user != frappe.session.user:
		frappe.throw(_("You do not have access to this request."), frappe.PermissionError)
	return doc


def _receipt_html(doc) -> str:
	escape = frappe.utils.escape_html
	return f"""<!doctype html><html><head><meta charset="utf-8"><style>
	@page {{ size:A4; margin:18mm; }}
	body {{ color:#20242a; font-family:Arial,sans-serif; font-size:10pt; }}
	.header {{ padding-bottom:14px; border-bottom:3px solid #c70d18; }}
	.header h1 {{ margin:0; color:#c70d18; font-size:19pt; }}
	.header p {{ margin:5px 0 0; color:#5d6672; }}
	.reference {{ margin:20px 0; padding:16px; border:1px solid #d9dde3; background:#f6f7f9; }}
	.reference span {{ display:block; color:#69717d; font-size:8pt; text-transform:uppercase; }}
	.reference strong {{ display:block; margin-top:5px; font-size:20pt; letter-spacing:1px; }}
	table {{ width:100%; border-collapse:collapse; }}
	td {{ padding:9px 4px; border-bottom:1px solid #e2e5e9; }}
	td:first-child {{ width:42%; color:#66707c; }}
	td:last-child {{ font-weight:700; text-align:right; }}
	.notice {{ margin-top:24px; padding:12px; color:#5d6672; border-left:3px solid #c70d18; background:#fff5f5; font-size:8.5pt; }}
	.footer {{ margin-top:28px; color:#7b838d; font-size:8pt; }}
	</style></head><body>
	<div class="header"><h1>MH Money Express</h1><p>Money transfer request receipt</p></div>
	<div class="reference"><span>Request ID</span><strong>{escape(doc.name)}</strong></div>
	<table>
	<tr><td>Submitted</td><td>{escape(format_datetime(doc.submitted_on or doc.creation))}</td></tr>
	<tr><td>Status</td><td>{escape(doc.status)}</td></tr>
	<tr><td>Customer</td><td>{escape(doc.customer_name or doc.customer)}</td></tr>
	<tr><td>Branch</td><td>{escape(doc.warehouse)}</td></tr>
	<tr><td>Destination</td><td>{escape(doc.destination_country)}</td></tr>
	<tr><td>Receive currency</td><td>{escape(doc.receive_currency)}</td></tr>
	<tr><td>Send amount</td><td>F$ {flt(doc.send_amount):,.2f}</td></tr>
	<tr><td>Recipient</td><td>{escape(doc.recipient_name)}</td></tr>
	<tr><td>Relationship</td><td>{escape(doc.recipient_relationship)}</td></tr>
	<tr><td>Purpose</td><td>{escape(doc.purpose)}</td></tr>
	<tr><td>Source of funds</td><td>{escape(doc.source_of_funds)}</td></tr>
	</table>
	<div class="notice">This receipt confirms submission of a customer request only. It is not proof of a completed money transfer. Provider acceptance, fees, exchange rates and payout remain subject to operator verification.</div>
	<div class="footer">Generated from the MH Money Express customer portal.</div>
	</body></html>"""


@frappe.whitelist(methods=["GET"])
def get_options() -> dict:
	_require_customer()
	branches = []
	for row in frappe.get_all(
		"Warehouse",
		filters={"is_group": 0, "disabled": 0, "custom_is_vault": 0},
		fields=["name", "warehouse_name", "city", "address_line_1", "address_line_2", "phone_no", "mobile_no"],
		order_by="warehouse_name asc",
		limit_page_length=500,
		ignore_permissions=True,
	):
		branches.append(
			{
				"value": row.name,
				"label": row.warehouse_name or row.name,
				"city": row.city,
				"address": ", ".join(filter(None, [row.address_line_1, row.address_line_2, row.city])),
				"phone": row.phone_no or row.mobile_no,
			}
		)
	return {"send_currency": "FJD", "destinations": _destination_rows(), "branches": branches}


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=10, seconds=60 * 60)
def create_request(
	destination_country: str,
	receive_currency: str,
	send_amount,
	warehouse: str,
	recipient_name: str,
	recipient_relationship: str,
	purpose: str,
	source_of_funds: str,
	customer_notes: str = "",
) -> dict:
	customer = _require_customer()
	destination_country, receive_currency = _validate_destination(destination_country, receive_currency)
	amount = flt(send_amount, 2)
	if amount <= 0:
		frappe.throw(_("Send amount must be greater than zero."), frappe.ValidationError)
	if not _active_branch(warehouse):
		frappe.throw(_("Select an active branch location."), frappe.ValidationError)

	required = {
		"recipient name": recipient_name,
		"relationship": recipient_relationship,
		"transfer purpose": purpose,
		"source of funds": source_of_funds,
	}
	for label, value in required.items():
		if not (value or "").strip():
			frappe.throw(_("Enter the {0}.").format(label), frappe.ValidationError)

	doc = frappe.get_doc(
		{
			"doctype": "Customer Money Transfer Request",
			"status": "Pending",
			"destination_country": destination_country,
			"receive_currency": receive_currency,
			"send_currency": "FJD",
			"send_amount": amount,
			"warehouse": warehouse,
			"customer": customer.name,
			"customer_name": customer.get("custom_full_name") or customer.customer_name,
			"portal_user": frappe.session.user,
			"recipient_name": recipient_name.strip()[:140],
			"recipient_relationship": recipient_relationship.strip()[:140],
			"purpose": purpose.strip()[:140],
			"source_of_funds": source_of_funds.strip()[:140],
			"customer_notes": (customer_notes or "").strip()[:500],
		}
	)
	doc.insert(ignore_permissions=True)
	return {
		"name": doc.name,
		"status": doc.status,
		"submitted_on": doc.submitted_on,
		"destination_country": doc.destination_country,
		"receive_currency": doc.receive_currency,
		"send_currency": doc.send_currency,
		"send_amount": doc.send_amount,
		"warehouse": doc.warehouse,
		"recipient_name": doc.recipient_name,
	}


@frappe.whitelist(methods=["GET"])
def list_my_requests(limit: int = 20) -> list[dict]:
	customer = _require_customer()
	return frappe.get_all(
		"Customer Money Transfer Request",
		filters={"customer": customer.name, "portal_user": frappe.session.user},
		fields=[
			"name", "destination_country", "receive_currency", "send_currency", "send_amount",
			"warehouse", "recipient_name", "status", "submitted_on", "provider_reference",
			"money_transfer_reference",
		],
		order_by="creation desc",
		limit_page_length=min(max(int(limit), 1), 100),
		ignore_permissions=True,
	)


@frappe.whitelist(methods=["GET"])
def download_receipt(request_id: str, inline: int = 0):
	doc = _owned_request(request_id)
	frappe.local.response.filename = f"{doc.name}-money-transfer-request.pdf"
	frappe.local.response.filecontent = get_pdf(_receipt_html(doc))
	frappe.local.response.type = "download"
	if int(inline or 0):
		frappe.local.response.display_content_as = "inline"
