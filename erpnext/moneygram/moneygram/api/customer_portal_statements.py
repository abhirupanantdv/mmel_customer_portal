"""Customer-owned consolidated, forex, transfer, and wallet statements."""

from __future__ import annotations

import csv
import io
from html import escape

import frappe
from frappe import _
from frappe.utils import add_days, flt, format_datetime, getdate, now_datetime, today
from frappe.utils.pdf import get_pdf

from moneygram.moneygram.api.customer_portal_auth import _customer_for_user
from moneygram.moneygram.api.customer_portal_transactions import _forex_row, _transfer_row


STATEMENT_TYPES = {
	"consolidated": "Consolidated statement",
	"forex": "Forex statement",
	"money_transfer": "Money transfer statement",
	"wallet": "Wallet statement",
}
STATEMENT_FORMATS = {"pdf", "csv"}


def _require_customer():
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	customer_name = _customer_for_user(frappe.session.user)
	if not customer_name:
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)
	return frappe.get_doc("Customer", customer_name)


def _parameters(statement_type: str, start_date: str, end_date: str):
	statement_type = (statement_type or "consolidated").strip().lower()
	if statement_type not in STATEMENT_TYPES:
		frappe.throw(_("Select a valid statement type."), frappe.ValidationError)
	end = getdate(end_date or today())
	start = getdate(start_date or add_days(end, -30))
	if start > end or (end - start).days > 366:
		frappe.throw(_("Select a valid statement period of up to 366 days."), frappe.ValidationError)
	return statement_type, start, end


def _request_rows(customer, statement_type: str, start, end) -> list[dict]:
	filters = {
		"customer": customer.name,
		"portal_user": frappe.session.user,
		"submitted_on": ["between", [f"{start} 00:00:00", f"{end} 23:59:59"]],
	}
	rows = []
	if statement_type in {"consolidated", "forex"}:
		forex = frappe.get_all(
			"Customer Forex Request",
			filters=filters,
			fields=[
				"name", "creation", "submitted_on", "completed_on", "status", "request_type",
				"foreign_currency", "foreign_amount", "warehouse", "estimated_total", "currency_exchange",
			],
			order_by="submitted_on asc",
			limit_page_length=0,
			ignore_permissions=True,
		)
		rows.extend(_forex_row(row) for row in forex)
	if statement_type in {"consolidated", "money_transfer"}:
		transfers = frappe.get_all(
			"Customer Money Transfer Request",
			filters=filters,
			fields=[
				"name", "creation", "submitted_on", "completed_on", "status", "destination_country",
				"receive_currency", "send_currency", "send_amount", "warehouse", "recipient_name",
				"provider_reference", "money_transfer_reference",
			],
			order_by="submitted_on asc",
			limit_page_length=0,
			ignore_permissions=True,
		)
		rows.extend(_transfer_row(row) for row in transfers)
	return rows


def _wallet_rows(customer, statement_type: str, start, end) -> list[dict]:
	if statement_type not in {"consolidated", "wallet"}:
		return []
	wallet = frappe.db.get_value("Customer Wallet", {"customer": customer.name, "portal_user": frappe.session.user}, "name")
	if not wallet:
		return []
	rows = frappe.get_all(
		"Customer Wallet Transaction",
		filters={
			"wallet": wallet,
			"customer": customer.name,
			"portal_user": frappe.session.user,
			"posting_datetime": ["between", [f"{start} 00:00:00", f"{end} 23:59:59"]],
		},
		fields=[
			"name", "transaction_type", "status", "amount", "currency", "direction", "description",
			"posting_datetime", "reference_name",
		],
		order_by="posting_datetime asc",
		limit_page_length=0,
		ignore_permissions=True,
	)
	return [
		{
			"id": row.name,
			"type": "Wallet",
			"date": row.posting_datetime,
			"reference": row.name,
			"operational_reference": row.reference_name,
			"description": row.description or row.transaction_type,
			"amount": flt(row.amount, 2),
			"currency": row.currency,
			"direction": (row.direction or "Neutral").lower(),
			"status": row.status,
			"branch": "—",
		}
		for row in rows
	]


def _statement_rows(customer, statement_type: str, start, end) -> list[dict]:
	rows = _request_rows(customer, statement_type, start, end) + _wallet_rows(customer, statement_type, start, end)
	return sorted(rows, key=lambda row: str(row.get("date") or ""))


def _summary(rows: list[dict]) -> dict:
	by_type = {"Forex Exchange": 0, "Money Transfer": 0, "Wallet": 0}
	totals = {}
	for row in rows:
		by_type[row["type"]] = by_type.get(row["type"], 0) + 1
		currency = row.get("currency") or "FJD"
		currency_totals = totals.setdefault(currency, {"credit": 0.0, "debit": 0.0, "neutral": 0.0})
		direction = row.get("direction") if row.get("direction") in currency_totals else "neutral"
		currency_totals[direction] = flt(currency_totals[direction] + flt(row.get("amount")), 2)
	return {"records": len(rows), "by_type": by_type, "totals": totals}


@frappe.whitelist(methods=["GET"])
def get_preview(statement_type: str = "consolidated", start_date: str = "", end_date: str = "") -> dict:
	customer = _require_customer()
	statement_type, start, end = _parameters(statement_type, start_date, end_date)
	rows = _statement_rows(customer, statement_type, start, end)
	return {
		"statement_type": statement_type,
		"statement_label": STATEMENT_TYPES[statement_type],
		"start_date": start,
		"end_date": end,
		"summary": _summary(rows),
		"recent": list(reversed(rows[-5:])),
	}


def _statement_html(customer, statement_type: str, start, end, rows: list[dict]) -> str:
	items = "".join(
		"<tr>"
		f"<td>{escape(format_datetime(row['date']))}</td>"
		f"<td>{escape(row['reference'])}</td>"
		f"<td>{escape(row.get('operational_reference') or '—')}</td>"
		f"<td>{escape(row['type'])}</td>"
		f"<td>{escape(row['description'])}</td>"
		f"<td>{escape(row['status'])}</td>"
		f"<td>{escape(row.get('direction', '').title())}</td>"
		f"<td>{escape(row['currency'])} {flt(row['amount'], 2):,.2f}</td>"
		"</tr>"
		for row in rows
	) or '<tr><td colspan="8">No records were found for this statement period.</td></tr>'
	return f"""
	<html><head><style>
	@page{{size:A4 landscape;margin:12mm}}body{{font-family:Arial,sans-serif;color:#20242a;font-size:9px}}h1{{margin:0;color:#c70d18;font-size:19px}}h2{{margin:4px 0 0;font-size:12px}}.meta{{margin:16px 0;padding:10px;background:#f4f5f7;line-height:1.7}}table{{width:100%;border-collapse:collapse}}th,td{{padding:6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}}th{{background:#20242a;color:#fff;font-size:8px}}.note{{margin-top:14px;color:#59616b;line-height:1.5}}
	</style></head><body><h1>MH Money Express</h1><h2>{escape(STATEMENT_TYPES[statement_type])}</h2>
	<div class="meta"><b>Customer:</b> {escape(customer.customer_name)} ({escape(customer.name)})<br><b>Period:</b> {start} to {end}<br><b>Generated:</b> {escape(format_datetime(now_datetime()))}<br><b>Records:</b> {len(rows)}</div>
	<table><thead><tr><th>Date</th><th>Request / Transaction</th><th>Operational reference</th><th>Type</th><th>Description</th><th>Status</th><th>Direction</th><th>Amount</th></tr></thead><tbody>{items}</tbody></table>
	<p class="note">Forex and money-transfer entries include customer requests at their recorded ERPNext status and are not proof of settlement unless marked Completed with an operational reference. Wallet entries are posted ledger records. Values shown for requests are the amounts recorded when the request was submitted.</p></body></html>
	"""


def _statement_csv(rows: list[dict]) -> bytes:
	stream = io.StringIO()
	writer = csv.writer(stream)
	writer.writerow(["Date", "Request / Transaction", "Operational Reference", "Type", "Description", "Status", "Direction", "Amount", "Currency", "Branch"])
	for row in rows:
		writer.writerow([
			row.get("date"), row.get("reference"), row.get("operational_reference"), row.get("type"),
			row.get("description"), row.get("status"), row.get("direction"), f"{flt(row.get('amount'), 2):.2f}",
			row.get("currency"), row.get("branch"),
		])
	return stream.getvalue().encode("utf-8-sig")


@frappe.whitelist(methods=["GET"])
def download_statement(
	statement_type: str = "consolidated",
	start_date: str = "",
	end_date: str = "",
	file_format: str = "pdf",
):
	customer = _require_customer()
	statement_type, start, end = _parameters(statement_type, start_date, end_date)
	file_format = (file_format or "pdf").strip().lower()
	if file_format not in STATEMENT_FORMATS:
		frappe.throw(_("Select PDF or CSV."), frappe.ValidationError)
	rows = _statement_rows(customer, statement_type, start, end)
	filename = f"{statement_type.replace('_', '-')}-statement-{start}-{end}.{file_format}"
	frappe.local.response.filename = filename
	frappe.local.response.filecontent = get_pdf(_statement_html(customer, statement_type, start, end, rows)) if file_format == "pdf" else _statement_csv(rows)
	frappe.local.response.type = "download"
