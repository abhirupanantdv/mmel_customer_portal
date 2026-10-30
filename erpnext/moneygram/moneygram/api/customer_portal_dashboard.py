"""Customer-isolated ERPNext summary for the portal dashboard."""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import add_months, flt, formatdate, getdate, today

from moneygram.moneygram.api.customer_portal_auth import _customer_for_user
from moneygram.moneygram.api.customer_portal_limits import RULES
from moneygram.moneygram.api.customer_portal_transactions import _history_rows, _summary


def _require_customer():
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	customer = _customer_for_user(frappe.session.user)
	if not customer:
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)
	return frappe.get_doc("Customer", customer)


def _wallet_summary(customer) -> dict:
	wallet = frappe.db.get_value(
		"Customer Wallet",
		{"customer": customer.name, "portal_user": frappe.session.user},
		["name", "status", "currency", "available_balance", "held_balance", "last_transaction_on"],
		as_dict=True,
	)
	if not wallet:
		return {"exists": False, "status": "Not created", "currency": "FJD", "available_balance": 0, "held_balance": 0, "last_transaction_on": None}
	return {
		"exists": True,
		"name": wallet.name,
		"status": wallet.status,
		"currency": wallet.currency or "FJD",
		"available_balance": flt(wallet.available_balance, 2),
		"held_balance": flt(wallet.held_balance, 2),
		"last_transaction_on": wallet.last_transaction_on,
	}


def _membership_summary(customer) -> dict:
	card = frappe.db.get_value(
		"Customer Membership Card",
		{"customer": customer.name, "portal_user": frappe.session.user},
		["card_number", "status", "profile_review_status", "card_review_status", "valid_until"],
		as_dict=True,
	)
	if not card:
		return {"exists": False, "status": "Not available", "profile_review_status": "Pending", "card_review_status": "Pending"}
	return {"exists": True, **card}


def _month_buckets() -> tuple[list[dict], dict[str, dict]]:
	first = getdate(today()).replace(day=1)
	months = [getdate(add_months(first, offset)) for offset in range(-5, 1)]
	rows = [
		{"key": month.strftime("%Y-%m"), "month": formatdate(month, "MMM"), "forex": 0.0, "transfers": 0.0, "wallet_in": 0.0, "wallet_out": 0.0}
		for month in months
	]
	return rows, {row["key"]: row for row in rows}


def _activity_chart(customer) -> list[dict]:
	rows, buckets = _month_buckets()
	start_date = f"{rows[0]['key']}-01"
	filters = {"customer": customer.name, "portal_user": frappe.session.user, "creation": [">=", start_date]}
	for row in frappe.get_all(
		"Customer Forex Request", filters=filters, fields=["creation", "estimated_total"], limit_page_length=5000, ignore_permissions=True,
	):
		key = getdate(row.creation).strftime("%Y-%m")
		if key in buckets:
			buckets[key]["forex"] = flt(buckets[key]["forex"] + flt(row.estimated_total), 2)
	for row in frappe.get_all(
		"Customer Money Transfer Request", filters=filters, fields=["creation", "send_amount"], limit_page_length=5000, ignore_permissions=True,
	):
		key = getdate(row.creation).strftime("%Y-%m")
		if key in buckets:
			buckets[key]["transfers"] = flt(buckets[key]["transfers"] + flt(row.send_amount), 2)
	for row in frappe.get_all(
		"Customer Wallet Transaction",
		filters={"customer": customer.name, "portal_user": frappe.session.user, "posting_datetime": [">=", start_date], "status": "Posted"},
		fields=["posting_datetime", "amount", "direction"], limit_page_length=5000, ignore_permissions=True,
	):
		key = getdate(row.posting_datetime).strftime("%Y-%m")
		if key not in buckets:
			continue
		field = "wallet_in" if row.direction == "Credit" else "wallet_out" if row.direction == "Debit" else None
		if field:
			buckets[key][field] = flt(buckets[key][field] + flt(row.amount), 2)
	return rows


@frappe.whitelist(methods=["GET"])
def get_dashboard() -> dict:
	customer = _require_customer()
	request_summary = _summary(customer)
	history = _history_rows(customer)
	active = [row for row in history if row["status"] in {"Pending", "In Review", "Approved"}]
	return {
		"as_of": today(),
		"customer": {"id": customer.name, "name": customer.customer_name},
		"wallet": _wallet_summary(customer),
		"requests": request_summary,
		"membership": _membership_summary(customer),
		"limits": {
			"rules": len(RULES),
			"usage_entries": frappe.db.count("Customer Exchange Control Usage", {"customer": customer.name, "portal_user": frappe.session.user}),
		},
		"current_request": active[0] if active else None,
		"recent_requests": history[:5],
		"activity": _activity_chart(customer),
	}
