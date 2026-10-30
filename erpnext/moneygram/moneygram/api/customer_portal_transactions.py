"""Unified, customer-isolated portal transaction history."""

from __future__ import annotations

import math

import frappe
from frappe import _
from frappe.utils import cint, flt

from moneygram.moneygram.api.customer_portal_auth import _customer_for_user


TRANSACTION_TYPES = {"Forex Exchange", "Money Transfer"}
TRANSACTION_STATUSES = {"Pending", "In Review", "Approved", "Completed", "Rejected", "Cancelled"}


def _require_customer():
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	customer = _customer_for_user(frappe.session.user)
	if not customer:
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)
	return frappe.get_doc("Customer", customer)


def _normalise_filters(transaction_type: str = "", status: str = "") -> tuple[str, str]:
	transaction_type = (transaction_type or "").strip()
	status = (status or "").strip()
	if transaction_type and transaction_type not in TRANSACTION_TYPES:
		frappe.throw(_("Select a valid transaction type."), frappe.ValidationError)
	if status and status not in TRANSACTION_STATUSES:
		frappe.throw(_("Select a valid transaction status."), frappe.ValidationError)
	return transaction_type, status


def _matches_search(row: dict, query: str) -> bool:
	if not query:
		return True
	searchable = " ".join(
		str(row.get(field) or "")
		for field in (
			"name", "status", "warehouse", "request_type", "foreign_currency",
			"destination_country", "receive_currency", "recipient_name",
			"currency_exchange", "provider_reference", "money_transfer_reference",
		)
	).lower()
	return query.lower() in searchable


def _forex_row(row: dict) -> dict:
	request_type = (row.request_type or "").upper()
	direction = "debit" if request_type == "BUY" else "credit"
	action = _("Buy") if request_type == "BUY" else _("Sell")
	return {
		"id": row.name,
		"type": "Forex Exchange",
		"date": row.submitted_on or row.creation,
		"completed_on": row.completed_on,
		"reference": row.name,
		"operational_reference": row.currency_exchange,
		"description": _("{0} {1} {2}").format(action, row.foreign_currency, flt(row.foreign_amount, 2)),
		"amount": flt(row.estimated_total, 2),
		"currency": "FJD",
		"direction": direction,
		"status": row.status,
		"branch": row.warehouse,
		"receipt_type": "forex",
	}


def _transfer_row(row: dict) -> dict:
	return {
		"id": row.name,
		"type": "Money Transfer",
		"date": row.submitted_on or row.creation,
		"completed_on": row.completed_on,
		"reference": row.name,
		"operational_reference": row.money_transfer_reference or row.provider_reference,
		"description": _("Transfer to {0} for {1}").format(row.destination_country, row.recipient_name),
		"amount": flt(row.send_amount, 2),
		"currency": row.send_currency or "FJD",
		"direction": "debit",
		"status": row.status,
		"branch": row.warehouse,
		"receipt_type": "money_transfer",
	}


def _history_rows(customer, transaction_type: str = "", status: str = "", search: str = "") -> list[dict]:
	base_filters = {"customer": customer.name, "portal_user": frappe.session.user}
	if status:
		base_filters["status"] = status
	rows = []
	if transaction_type in {"", "Forex Exchange"}:
		forex = frappe.get_all(
			"Customer Forex Request",
			filters=base_filters,
			fields=[
				"name", "creation", "submitted_on", "completed_on", "status", "request_type",
				"foreign_currency", "foreign_amount", "warehouse", "estimated_total", "currency_exchange",
			],
			order_by="creation desc",
			limit_page_length=1000,
			ignore_permissions=True,
		)
		rows.extend(_forex_row(row) for row in forex if _matches_search(row, search))
	if transaction_type in {"", "Money Transfer"}:
		transfers = frappe.get_all(
			"Customer Money Transfer Request",
			filters=base_filters,
			fields=[
				"name", "creation", "submitted_on", "completed_on", "status", "destination_country",
				"receive_currency", "send_currency", "send_amount", "warehouse", "recipient_name",
				"provider_reference", "money_transfer_reference",
			],
			order_by="creation desc",
			limit_page_length=1000,
			ignore_permissions=True,
		)
		rows.extend(_transfer_row(row) for row in transfers if _matches_search(row, search))
	return sorted(rows, key=lambda row: str(row["date"] or ""), reverse=True)


def _summary(customer) -> dict:
	filters = {"customer": customer.name, "portal_user": frappe.session.user}
	counts = {
		status: frappe.db.count("Customer Forex Request", {**filters, "status": status})
		+ frappe.db.count("Customer Money Transfer Request", {**filters, "status": status})
		for status in TRANSACTION_STATUSES
	}
	return {
		"total": sum(counts.values()),
		"pending": sum(counts[status] for status in {"Pending", "In Review", "Approved"}),
		"completed": counts["Completed"],
		"rejected_or_cancelled": counts["Rejected"] + counts["Cancelled"],
	}


@frappe.whitelist(methods=["GET"])
def list_transactions(
	page: int = 1,
	page_length: int = 20,
	transaction_type: str = "",
	status: str = "",
	search: str = "",
) -> dict:
	customer = _require_customer()
	transaction_type, status = _normalise_filters(transaction_type, status)
	page = max(cint(page), 1)
	page_length = min(max(cint(page_length), 1), 50)
	search = (search or "").strip()[:100]
	rows = _history_rows(customer, transaction_type, status, search)
	total = len(rows)
	start = (page - 1) * page_length
	return {
		"data": rows[start:start + page_length],
		"pagination": {
			"page": page,
			"page_length": page_length,
			"total": total,
			"total_pages": max(math.ceil(total / page_length), 1),
		},
		"summary": _summary(customer),
		"filters": {
			"types": sorted(TRANSACTION_TYPES),
			"statuses": ["Pending", "In Review", "Approved", "Completed", "Rejected", "Cancelled"],
		},
	}


def _owned_doc(transaction_id: str):
	customer = _require_customer()
	transaction_id = (transaction_id or "").strip()
	if not transaction_id:
		frappe.throw(_("Transaction reference is required."), frappe.ValidationError)
	if transaction_id.startswith("FXR-"):
		doctype = "Customer Forex Request"
	elif transaction_id.startswith("MTR-"):
		doctype = "Customer Money Transfer Request"
	else:
		frappe.throw(_("Transaction was not found."), frappe.DoesNotExistError)
	doc = frappe.get_doc(doctype, transaction_id)
	if doc.customer != customer.name or doc.portal_user != frappe.session.user:
		frappe.throw(_("You do not have access to this transaction."), frappe.PermissionError)
	return doc


@frappe.whitelist(methods=["GET"])
def get_transaction(transaction_id: str) -> dict:
	doc = _owned_doc(transaction_id)
	if doc.doctype == "Customer Forex Request":
		row = _forex_row(doc.as_dict())
		row.update(
			{
				"request_type": doc.request_type,
				"foreign_currency": doc.foreign_currency,
				"foreign_amount": flt(doc.foreign_amount, 2),
				"exchange_rate": flt(doc.exchange_rate, 9),
				"estimated_fjd_amount": flt(doc.estimated_fjd_amount, 2),
				"service_fee": flt(doc.service_fee, 2),
				"estimated_total": flt(doc.estimated_total, 2),
				"customer_notes": doc.customer_notes,
			}
		)
		return row
	row = _transfer_row(doc.as_dict())
	row.update(
		{
			"destination_country": doc.destination_country,
			"receive_currency": doc.receive_currency,
			"send_amount": flt(doc.send_amount, 2),
			"recipient_name": doc.recipient_name,
			"recipient_relationship": doc.recipient_relationship,
			"purpose": doc.purpose,
			"source_of_funds": doc.source_of_funds,
			"provider_reference": doc.provider_reference,
			"money_transfer_reference": doc.money_transfer_reference,
			"customer_notes": doc.customer_notes,
		}
	)
	return row
