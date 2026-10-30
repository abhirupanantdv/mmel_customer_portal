"""Customer portal forex quotes and request submission."""

from __future__ import annotations

import re
from datetime import timedelta

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import flt, format_datetime, getdate, now_datetime, nowdate
from frappe.utils.pdf import get_pdf

from moneygram.moneygram.api.customer_portal_auth import _customer_for_user


QUOTE_MINUTES = 10


def _require_customer():
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	customer = _customer_for_user(frappe.session.user)
	if not customer:
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)
	return frappe.get_doc("Customer", customer)


def _request_type(value: str) -> str:
	value = (value or "").strip().upper()
	if value not in {"BUY", "SELL"}:
		frappe.throw(_("Request type must be BUY or SELL."), frappe.ValidationError)
	return value


def _currency(value: str) -> str:
	value = (value or "").strip().upper()
	if not re.fullmatch(r"[A-Z]{3}", value) or value == "FJD":
		frappe.throw(_("Select a valid foreign currency."), frappe.ValidationError)
	return value


def _price_list(warehouse: str, request_type: str) -> str:
	flag = "selling" if request_type == "BUY" else "buying"
	price_list = frappe.db.get_value(
		"Price List",
		{"custom_warehouse": warehouse, "enabled": 1, flag: 1},
		"name",
	)
	if not price_list:
		frappe.throw(_("No active {0} price list is configured for this branch.").format(flag), frappe.ValidationError)
	return price_list


def _active_price_rows(price_list: str, currency: str | None = None) -> list[dict]:
	filters = {"price_list": price_list, "item_code": ["like", f"{currency} %"]} if currency else {"price_list": price_list}
	rows = frappe.get_all(
		"Item Price",
		filters=filters,
		fields=["name", "item_code", "price_list", "price_list_rate", "valid_from", "valid_upto", "modified"],
		order_by="modified desc",
		limit_page_length=1000,
		ignore_permissions=True,
	)
	today = getdate(nowdate())
	return [
		row for row in rows
		if flt(row.price_list_rate) > 0
		and (not row.valid_from or getdate(row.valid_from) <= today)
		and (not row.valid_upto or getdate(row.valid_upto) >= today)
	]


def _rate_source(warehouse: str, request_type: str, currency: str) -> dict:
	price_list = _price_list(warehouse, request_type)
	for row in _active_price_rows(price_list, currency):
		item = frappe.db.get_value(
			"Item",
			{"name": row.item_code, "disabled": 0},
			["name", "custom_attribute_value"],
			as_dict=True,
		)
		denomination = flt(item.custom_attribute_value) if item else 0
		if denomination > 0:
			return {
				# MoneyGram stores the change rate as foreign units per FJD.
				# Item Price is the FJD value of one denomination, so reversing
				# that denomination price restores the configured change rate.
				"rate": denomination / flt(row.price_list_rate),
				"item_price": row.name,
				"item": row.item_code,
				"price_list": price_list,
				"valid_from": row.valid_from,
				"valid_upto": row.valid_upto,
			}
	frappe.throw(_("No current Item Price is available for {0} at this branch.").format(currency), frappe.ValidationError)


def _branch_is_available(warehouse: str) -> bool:
	return bool(
		frappe.db.exists(
			"Warehouse",
			{"name": warehouse, "is_group": 0, "disabled": 0, "custom_is_vault": 0},
		)
	)


def _quote(request_type: str, currency: str, foreign_amount, warehouse: str) -> dict:
	request_type = _request_type(request_type)
	currency = _currency(currency)
	amount = flt(foreign_amount, 2)
	if amount <= 0:
		frappe.throw(_("Foreign amount must be greater than zero."), frappe.ValidationError)
	if not _branch_is_available(warehouse):
		frappe.throw(_("Select an active branch location."), frappe.ValidationError)

	source = _rate_source(warehouse, request_type, currency)
	rate = flt(source["rate"], 9)
	fjd_amount = flt(amount / rate, 2)
	service_fee = 0.0
	return {
		"request_type": request_type,
		"foreign_currency": currency,
		"foreign_amount": amount,
		"warehouse": warehouse,
		"exchange_rate": rate,
		"estimated_fjd_amount": fjd_amount,
		"service_fee": service_fee,
		"estimated_total": flt(fjd_amount + service_fee, 2),
		"rate_item_price": source["item_price"],
		"rate_item": source["item"],
		"rate_price_list": source["price_list"],
		"rate_valid_from": source["valid_from"],
		"rate_valid_upto": source["valid_upto"],
		"quote_expires_on": now_datetime() + timedelta(minutes=QUOTE_MINUTES),
	}


def _owned_request(request_id: str):
	customer = _require_customer()
	request_id = (request_id or "").strip()
	if not request_id:
		frappe.throw(_("Request ID is required."), frappe.ValidationError)
	doc = frappe.get_doc("Customer Forex Request", request_id)
	if doc.customer != customer.name or doc.portal_user != frappe.session.user:
		frappe.throw(_("You do not have access to this request."), frappe.PermissionError)
	return doc


def _receipt_html(doc) -> str:
	escape = frappe.utils.escape_html
	request_type = "Buy foreign currency" if doc.request_type == "BUY" else "Sell foreign currency"
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
	<div class="header"><h1>MH Money Express</h1><p>Foreign exchange request receipt</p></div>
	<div class="reference"><span>Request ID</span><strong>{escape(doc.name)}</strong></div>
	<table>
	<tr><td>Submitted</td><td>{escape(format_datetime(doc.submitted_on or doc.creation))}</td></tr>
	<tr><td>Status</td><td>{escape(doc.status)}</td></tr>
	<tr><td>Request type</td><td>{escape(request_type)}</td></tr>
	<tr><td>Customer</td><td>{escape(doc.customer_name or doc.customer)}</td></tr>
	<tr><td>Branch</td><td>{escape(doc.warehouse)}</td></tr>
	<tr><td>Foreign amount</td><td>{escape(doc.foreign_currency)} {flt(doc.foreign_amount):,.2f}</td></tr>
	<tr><td>Exchange rate</td><td>1 FJD = {flt(doc.exchange_rate):,.6f} {escape(doc.foreign_currency)}</td></tr>
	<tr><td>Estimated FJD amount</td><td>F$ {flt(doc.estimated_fjd_amount):,.2f}</td></tr>
	<tr><td>Service fee</td><td>F$ {flt(doc.service_fee):,.2f}</td></tr>
	<tr><td>Estimated total</td><td>F$ {flt(doc.estimated_total):,.2f}</td></tr>
	</table>
	<div class="notice">This receipt confirms submission of a customer request only. It is not proof of a completed foreign exchange transaction. The final rate and amount remain subject to operator verification.</div>
	<div class="footer">Generated from the MH Money Express customer portal.</div>
	</body></html>"""


@frappe.whitelist(methods=["GET"])
def get_options(request_type: str = "BUY") -> dict:
	_require_customer()
	request_type = _request_type(request_type)
	flag = "selling" if request_type == "BUY" else "buying"
	price_lists = frappe.get_all(
		"Price List",
		filters={"enabled": 1, flag: 1, "custom_warehouse": ["is", "set"]},
		fields=["name", "custom_warehouse"],
		limit_page_length=500,
		ignore_permissions=True,
	)
	branches = []
	currencies = set()
	seen = set()
	for price_list in price_lists:
		warehouse = price_list.custom_warehouse
		if warehouse in seen or not _branch_is_available(warehouse):
			continue
		branch_currencies = set()
		for row in _active_price_rows(price_list.name):
			code = (row.item_code or "").split(" ", 1)[0].upper()
			if re.fullmatch(r"[A-Z]{3}", code) and code != "FJD":
				branch_currencies.add(code)
		if not branch_currencies:
			continue
		warehouse_doc = frappe.get_doc("Warehouse", warehouse)
		branches.append(
			{
				"value": warehouse,
				"label": warehouse_doc.warehouse_name or warehouse,
				"city": warehouse_doc.city,
				"address": ", ".join(filter(None, [warehouse_doc.address_line_1, warehouse_doc.address_line_2, warehouse_doc.city])),
				"phone": warehouse_doc.phone_no or warehouse_doc.mobile_no,
				"currencies": sorted(branch_currencies),
			}
		)
		currencies.update(branch_currencies)
		seen.add(warehouse)
	return {"request_type": request_type, "base_currency": "FJD", "currencies": sorted(currencies), "branches": branches}


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=60, seconds=60 * 60)
def get_quote(request_type: str, currency: str, foreign_amount, warehouse: str) -> dict:
	_require_customer()
	return _quote(request_type, currency, foreign_amount, warehouse)


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=10, seconds=60 * 60)
def create_request(request_type: str, currency: str, foreign_amount, warehouse: str, customer_notes: str = "") -> dict:
	customer = _require_customer()
	quote = _quote(request_type, currency, foreign_amount, warehouse)
	doc = frappe.get_doc(
		{
			"doctype": "Customer Forex Request",
			"status": "Pending",
			"request_type": quote["request_type"],
			"foreign_currency": quote["foreign_currency"],
			"foreign_amount": quote["foreign_amount"],
			"warehouse": quote["warehouse"],
			"customer": customer.name,
			"customer_name": customer.get("custom_full_name") or customer.customer_name,
			"portal_user": frappe.session.user,
			"exchange_rate": quote["exchange_rate"],
			"estimated_fjd_amount": quote["estimated_fjd_amount"],
			"service_fee": quote["service_fee"],
			"estimated_total": quote["estimated_total"],
			"rate_item_price": quote["rate_item_price"],
			"rate_item": quote["rate_item"],
			"rate_price_list": quote["rate_price_list"],
			"rate_valid_from": quote["rate_valid_from"],
			"rate_valid_upto": quote["rate_valid_upto"],
			"quote_expires_on": quote["quote_expires_on"],
			"customer_notes": (customer_notes or "").strip()[:500],
		}
	)
	doc.insert(ignore_permissions=True)
	return {"name": doc.name, "status": doc.status, "submitted_on": doc.submitted_on, **quote}


@frappe.whitelist(methods=["GET"])
def list_my_requests(limit: int = 20) -> list[dict]:
	customer = _require_customer()
	return frappe.get_all(
		"Customer Forex Request",
		filters={"customer": customer.name, "portal_user": frappe.session.user},
		fields=["name", "request_type", "foreign_currency", "foreign_amount", "warehouse", "exchange_rate", "estimated_total", "status", "submitted_on", "currency_exchange"],
		order_by="creation desc",
		limit_page_length=min(max(int(limit), 1), 100),
		ignore_permissions=True,
	)


@frappe.whitelist(methods=["GET"])
def download_receipt(request_id: str, inline: int = 0):
	doc = _owned_request(request_id)
	frappe.local.response.filename = f"{doc.name}-forex-request.pdf"
	frappe.local.response.filecontent = get_pdf(_receipt_html(doc))
	frappe.local.response.type = "download"
	if int(inline or 0):
		frappe.local.response.display_content_as = "inline"
