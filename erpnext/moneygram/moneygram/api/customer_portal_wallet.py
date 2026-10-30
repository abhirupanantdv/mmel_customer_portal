"""Customer-isolated digital wallet APIs backed by ERPNext accounting."""

from __future__ import annotations

import math
from html import escape

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, format_datetime, getdate, now_datetime, today
from frappe.utils.pdf import get_pdf

from moneygram.moneygram.api.customer_portal_auth import _customer_for_user


REQUEST_METHODS = {"Bank Transfer", "Cash Deposit", "M-PAiSA", "MyCash", "Other"}
FINAL_REQUEST_STATUSES = {"Completed", "Rejected", "Cancelled"}


def _require_customer():
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	customer_name = _customer_for_user(frappe.session.user)
	if not customer_name:
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)
	return frappe.get_doc("Customer", customer_name)


def _settings(require_enabled: bool = False):
	settings = frappe.get_single("Customer Wallet Settings")
	if require_enabled and not settings.enabled:
		frappe.throw(_("The digital wallet is not currently available."), frappe.ValidationError)
	return settings


def _get_or_create_wallet(customer, settings=None):
	settings = settings or _settings()
	name = frappe.db.get_value("Customer Wallet", {"customer": customer.name}, "name")
	if name:
		wallet = frappe.get_doc("Customer Wallet", name)
		if wallet.portal_user and wallet.portal_user != frappe.session.user:
			frappe.throw(_("You do not have access to this wallet."), frappe.PermissionError)
		return wallet
	return frappe.get_doc(
		{
			"doctype": "Customer Wallet",
			"customer": customer.name,
			"customer_name": customer.customer_name,
			"portal_user": frappe.session.user,
			"currency": settings.currency or "FJD",
			"status": "Active",
		}
	).insert(ignore_permissions=True)


def _owned_wallet():
	customer = _require_customer()
	return customer, _get_or_create_wallet(customer)


def _owned_request(request_id: str):
	customer = _require_customer()
	request_id = (request_id or "").strip()
	if not request_id:
		frappe.throw(_("Wallet request ID is required."), frappe.ValidationError)
	doc = frappe.get_doc("Customer Wallet Request", request_id)
	if doc.customer != customer.name or doc.portal_user != frappe.session.user:
		frappe.throw(_("You do not have access to this wallet request."), frappe.PermissionError)
	return doc


def _operator_request(request_id: str):
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	if not frappe.has_permission("Customer Wallet Request", "write"):
		frappe.throw(_("You are not permitted to process wallet requests."), frappe.PermissionError)
	return frappe.get_doc("Customer Wallet Request", (request_id or "").strip())


def _validate_accounts(settings):
	for field in ("wallet_liability_account", "funding_account", "withdrawal_account"):
		account = settings.get(field)
		if not account or not frappe.db.exists(
			"Account", {"name": account, "company": settings.company, "is_group": 0, "disabled": 0}
		):
			frappe.throw(_("Wallet accounting is not configured correctly. Contact an administrator."))


def _journal_entry(request, settings):
	_validate_accounts(settings)
	if request.request_type == "Funding":
		debit_account = settings.funding_account
		credit_account = settings.wallet_liability_account
	else:
		debit_account = settings.wallet_liability_account
		credit_account = settings.withdrawal_account

	entry = frappe.get_doc(
		{
			"doctype": "Journal Entry",
			"voucher_type": "Journal Entry",
			"company": settings.company,
			"posting_date": today(),
			"user_remark": _("Customer wallet {0} {1}").format(request.request_type.lower(), request.name),
			"accounts": [
				{"account": debit_account, "debit_in_account_currency": request.amount, "credit_in_account_currency": 0},
				{"account": credit_account, "debit_in_account_currency": 0, "credit_in_account_currency": request.amount},
			],
		}
	)
	entry.flags.ignore_permissions = True
	entry.insert()
	entry.submit()
	return entry


def _post_request_transaction(request, settings):
	existing = frappe.db.get_value(
		"Customer Wallet Transaction", {"idempotency_key": f"wallet-request:{request.name}"}, "name"
	)
	if existing:
		return frappe.get_doc("Customer Wallet Transaction", existing)

	frappe.db.sql("select name from `tabCustomer Wallet` where name=%s for update", request.wallet)
	wallet = frappe.get_doc("Customer Wallet", request.wallet)
	if wallet.status != "Active":
		frappe.throw(_("This wallet is not active."))
	amount = flt(request.amount, 2)
	available = flt(wallet.available_balance, 2)
	if request.request_type == "Withdrawal" and available < amount:
		frappe.throw(_("The wallet does not have enough available balance for this withdrawal."))

	entry = _journal_entry(request, settings)
	available = available + amount if request.request_type == "Funding" else available - amount
	posting_time = now_datetime()
	frappe.db.set_value(
		"Customer Wallet", wallet.name,
		{
			"available_balance": available,
			"total_balance": available + flt(wallet.held_balance, 2),
			"last_transaction_on": posting_time,
		},
		update_modified=True,
	)
	transaction = frappe.get_doc(
		{
			"doctype": "Customer Wallet Transaction",
			"wallet": wallet.name,
			"customer": wallet.customer,
			"portal_user": wallet.portal_user,
			"transaction_type": request.request_type,
			"status": "Posted",
			"amount": amount,
			"currency": wallet.currency,
			"direction": "Credit" if request.request_type == "Funding" else "Debit",
			"posting_datetime": posting_time,
			"available_balance_after": available,
			"held_balance_after": flt(wallet.held_balance, 2),
			"description": _("{0} request {1}").format(request.request_type, request.name),
			"reference_doctype": request.doctype,
			"reference_name": request.name,
			"journal_entry": entry.name,
			"idempotency_key": f"wallet-request:{request.name}",
			"initiated_by": request.portal_user,
			"approved_by": frappe.session.user,
		}
	).insert(ignore_permissions=True)
	return transaction


def _loyalty(customer):
	program_name = customer.loyalty_program
	if not program_name:
		return {"configured": False, "program": None, "points": 0, "value": 0, "currency": "FJD", "entries": []}
	program = frappe.get_doc("Loyalty Program", program_name)
	points = frappe.db.sql(
		"""
		select coalesce(sum(loyalty_points), 0)
		from `tabLoyalty Point Entry`
		where customer=%s and loyalty_program=%s and company=%s
			and (expiry_date is null or expiry_date='' or expiry_date >= %s)
		""",
		(customer.name, program.name, program.company, today()),
	)[0][0]
	entries = frappe.get_all(
		"Loyalty Point Entry",
		filters={"customer": customer.name, "loyalty_program": program.name, "company": program.company},
		fields=["name", "posting_date", "loyalty_points", "expiry_date", "invoice_type", "invoice"],
		order_by="posting_date desc, creation desc",
		limit_page_length=10,
		ignore_permissions=True,
	)
	return {
		"configured": True,
		"program": program.name,
		"tier": customer.loyalty_program_tier,
		"points": cint(points),
		"conversion_factor": flt(program.conversion_factor, 6),
		"value": flt(points * program.conversion_factor, 2),
		"currency": frappe.db.get_value("Company", program.company, "default_currency") or "FJD",
		"entries": entries,
	}


def _transaction_dict(row):
	return {
		"name": row.name,
		"transaction_type": row.transaction_type,
		"status": row.status,
		"amount": flt(row.amount, 2),
		"currency": row.currency,
		"direction": row.direction.lower(),
		"description": row.description,
		"posting_datetime": row.posting_datetime,
		"available_balance_after": flt(row.available_balance_after, 2),
		"held_balance_after": flt(row.held_balance_after, 2),
		"reference_doctype": row.reference_doctype,
		"reference_name": row.reference_name,
	}


@frappe.whitelist(methods=["GET"])
def get_wallet() -> dict:
	customer, wallet = _owned_wallet()
	settings = _settings()
	recent = frappe.get_all(
		"Customer Wallet Transaction",
		filters={"wallet": wallet.name, "customer": customer.name, "portal_user": frappe.session.user},
		fields=["name", "transaction_type", "status", "amount", "currency", "direction", "description", "posting_datetime", "available_balance_after", "held_balance_after", "reference_doctype", "reference_name"],
		order_by="posting_datetime desc",
		limit_page_length=5,
		ignore_permissions=True,
	)
	pending = frappe.db.count(
		"Customer Wallet Request",
		{"wallet": wallet.name, "customer": customer.name, "portal_user": frappe.session.user, "status": ["in", ["Pending", "In Review"]]},
	)
	return {
		"wallet": {
			"name": wallet.name,
			"status": wallet.status,
			"currency": wallet.currency,
			"available_balance": flt(wallet.available_balance, 2),
			"held_balance": flt(wallet.held_balance, 2),
			"total_balance": flt(wallet.total_balance, 2),
			"last_transaction_on": wallet.last_transaction_on,
		},
		"enabled": bool(settings.enabled),
		"allow_withdrawals": bool(settings.allow_withdrawals),
		"request_limits": {"minimum": flt(settings.minimum_request_amount, 2), "maximum": flt(settings.maximum_request_amount, 2)},
		"pending_requests": pending,
		"recent_transactions": [_transaction_dict(row) for row in recent],
		"loyalty": _loyalty(customer),
	}


@frappe.whitelist(methods=["GET"])
def list_transactions(page: int = 1, page_length: int = 20, transaction_type: str = "") -> dict:
	customer, wallet = _owned_wallet()
	page = max(cint(page), 1)
	page_length = min(max(cint(page_length), 1), 50)
	filters = {"wallet": wallet.name, "customer": customer.name, "portal_user": frappe.session.user}
	if transaction_type:
		if transaction_type not in {"Funding", "Withdrawal", "Hold", "Release", "Capture", "Refund", "Reversal", "Adjustment"}:
			frappe.throw(_("Select a valid wallet transaction type."), frappe.ValidationError)
		filters["transaction_type"] = transaction_type
	total = frappe.db.count("Customer Wallet Transaction", filters)
	rows = frappe.get_all(
		"Customer Wallet Transaction", filters=filters,
		fields=["name", "transaction_type", "status", "amount", "currency", "direction", "description", "posting_datetime", "available_balance_after", "held_balance_after", "reference_doctype", "reference_name"],
		order_by="posting_datetime desc", start=(page - 1) * page_length, page_length=page_length,
		ignore_permissions=True,
	)
	return {
		"data": [_transaction_dict(row) for row in rows],
		"pagination": {"page": page, "page_length": page_length, "total": total, "total_pages": max(math.ceil(total / page_length), 1)},
	}


@frappe.whitelist(methods=["GET"])
def list_requests(limit: int = 20) -> list[dict]:
	customer, wallet = _owned_wallet()
	rows = frappe.get_all(
		"Customer Wallet Request",
		filters={"wallet": wallet.name, "customer": customer.name, "portal_user": frappe.session.user},
		fields=["name", "request_type", "status", "amount", "currency", "funding_method", "payment_reference", "submitted_on", "completed_on", "operator_remarks"],
		order_by="creation desc", limit_page_length=min(max(cint(limit), 1), 50), ignore_permissions=True,
	)
	return [{**row, "amount": flt(row.amount, 2)} for row in rows]


@frappe.whitelist(methods=["POST"])
def create_request(request_type: str, amount: float, funding_method: str, payment_reference: str = "", customer_notes: str = "") -> dict:
	settings = _settings(require_enabled=True)
	customer = _require_customer()
	wallet = _get_or_create_wallet(customer, settings)
	request_type = (request_type or "").strip().title()
	funding_method = (funding_method or "").strip()
	amount = flt(amount, 2)
	if request_type not in {"Funding", "Withdrawal"}:
		frappe.throw(_("Select Funding or Withdrawal."), frappe.ValidationError)
	if request_type == "Withdrawal" and not settings.allow_withdrawals:
		frappe.throw(_("Wallet withdrawals are not currently available."), frappe.ValidationError)
	if funding_method not in REQUEST_METHODS:
		frappe.throw(_("Select a valid funding or payout method."), frappe.ValidationError)
	if amount < flt(settings.minimum_request_amount) or amount > flt(settings.maximum_request_amount):
		frappe.throw(
			_("Enter an amount between {0} and {1} {2}.").format(settings.minimum_request_amount, settings.maximum_request_amount, settings.currency),
			frappe.ValidationError,
		)
	if request_type == "Withdrawal" and amount > flt(wallet.available_balance, 2):
		frappe.throw(_("The requested withdrawal exceeds your available wallet balance."), frappe.ValidationError)
	doc = frappe.get_doc(
		{
			"doctype": "Customer Wallet Request", "request_type": request_type, "status": "Pending",
			"amount": amount, "currency": wallet.currency, "wallet": wallet.name, "customer": customer.name,
			"customer_name": customer.customer_name, "portal_user": frappe.session.user,
			"funding_method": funding_method, "payment_reference": (payment_reference or "").strip()[:140],
			"customer_notes": (customer_notes or "").strip()[:500],
		}
	).insert(ignore_permissions=True)
	return {"name": doc.name, "request_type": doc.request_type, "status": doc.status, "amount": flt(doc.amount, 2), "currency": doc.currency, "submitted_on": doc.submitted_on}


@frappe.whitelist(methods=["POST"])
def cancel_request(request_id: str) -> dict:
	doc = _owned_request(request_id)
	if doc.status != "Pending":
		frappe.throw(_("Only pending wallet requests can be cancelled."), frappe.ValidationError)
	doc.status = "Cancelled"
	doc.save(ignore_permissions=True)
	return {"name": doc.name, "status": doc.status}


@frappe.whitelist(methods=["POST"])
def approve_request(request_id: str) -> dict:
	doc = _operator_request(request_id)
	if doc.status in FINAL_REQUEST_STATUSES:
		frappe.throw(_("This wallet request is already closed."), frappe.ValidationError)
	settings = _settings(require_enabled=True)
	transaction = _post_request_transaction(doc, settings)
	doc.status = "Completed"
	doc.operator = frappe.session.user
	doc.wallet_transaction = transaction.name
	doc.journal_entry = transaction.journal_entry
	doc.completed_on = now_datetime()
	doc.save(ignore_permissions=True)
	return {"request": doc.name, "status": doc.status, "wallet_transaction": transaction.name, "journal_entry": transaction.journal_entry}


@frappe.whitelist(methods=["POST"])
def reject_request(request_id: str, remarks: str) -> dict:
	doc = _operator_request(request_id)
	if doc.status in FINAL_REQUEST_STATUSES:
		frappe.throw(_("This wallet request is already closed."), frappe.ValidationError)
	remarks = (remarks or "").strip()
	if not remarks:
		frappe.throw(_("Enter a reason for rejecting this request."), frappe.ValidationError)
	doc.status = "Rejected"
	doc.operator = frappe.session.user
	doc.operator_remarks = remarks[:500]
	doc.completed_on = now_datetime()
	doc.save(ignore_permissions=True)
	return {"request": doc.name, "status": doc.status}


def _statement_html(customer, wallet, rows, start_date, end_date):
	items = "".join(
		f"<tr><td>{escape(str(row.posting_datetime))}</td><td>{escape(row.name)}</td><td>{escape(row.transaction_type)}</td>"
		f"<td>{escape(row.description or '')}</td><td>{escape(row.direction)}</td><td>{flt(row.amount, 2):,.2f}</td>"
		f"<td>{flt(row.available_balance_after, 2):,.2f}</td></tr>" for row in rows
	) or '<tr><td colspan="7">No wallet entries in this period.</td></tr>'
	return f"""
	<html><head><style>
	body{{font-family:Arial,sans-serif;color:#20242a;font-size:10px}}h1{{color:#c70d18}}table{{width:100%;border-collapse:collapse}}th,td{{padding:7px;border-bottom:1px solid #ddd;text-align:left}}th{{background:#f2f3f5}}.meta{{margin:18px 0}}
	</style></head><body><h1>MH Money Express — Wallet Statement</h1>
	<div class="meta"><b>Customer:</b> {escape(customer.customer_name)} ({escape(customer.name)})<br><b>Wallet:</b> {escape(wallet.name)}<br><b>Period:</b> {start_date} to {end_date}<br><b>Generated:</b> {escape(format_datetime(now_datetime()))}</div>
	<table><thead><tr><th>Date</th><th>Transaction</th><th>Type</th><th>Description</th><th>Direction</th><th>Amount ({escape(wallet.currency)})</th><th>Available after</th></tr></thead><tbody>{items}</tbody></table>
	<p>This statement contains posted wallet ledger entries. Pending funding or withdrawal requests are not included.</p></body></html>
	"""


@frappe.whitelist(methods=["GET"])
def download_statement(start_date: str = "", end_date: str = ""):
	customer, wallet = _owned_wallet()
	end = getdate(end_date or today())
	start = getdate(start_date or add_days(end, -30))
	if start > end or (end - start).days > 366:
		frappe.throw(_("Select a valid statement period of up to 366 days."), frappe.ValidationError)
	rows = frappe.get_all(
		"Customer Wallet Transaction",
		filters={"wallet": wallet.name, "customer": customer.name, "portal_user": frappe.session.user, "posting_datetime": ["between", [start, add_days(end, 1)]]},
		fields=["name", "transaction_type", "description", "direction", "amount", "posting_datetime", "available_balance_after"],
		order_by="posting_datetime asc", ignore_permissions=True,
	)
	frappe.local.response.filename = f"wallet-statement-{start}-{end}.pdf"
	frappe.local.response.filecontent = get_pdf(_statement_html(customer, wallet, rows, start, end))
	frappe.local.response.type = "download"


@frappe.whitelist(methods=["GET"])
def download_request_receipt(request_id: str):
	doc = _owned_request(request_id)
	html = f"""
	<html><head><style>body{{font-family:Arial,sans-serif;color:#20242a}}h1{{color:#c70d18}}dl{{display:grid;grid-template-columns:180px 1fr;gap:8px}}dt{{color:#68707d}}dd{{font-weight:bold}}</style></head><body>
	<h1>MH Money Express — Wallet Request</h1><dl><dt>Request ID</dt><dd>{escape(doc.name)}</dd><dt>Type</dt><dd>{escape(doc.request_type)}</dd><dt>Status</dt><dd>{escape(doc.status)}</dd><dt>Amount</dt><dd>{escape(doc.currency)} {flt(doc.amount, 2):,.2f}</dd><dt>Method</dt><dd>{escape(doc.funding_method)}</dd><dt>Submitted</dt><dd>{escape(str(doc.submitted_on))}</dd></dl>
	<p>This receipt confirms submission of a wallet request. It is not proof that funds have been credited, withdrawn, or settled. Only a Completed status and posted ERPNext ledger entry confirm processing.</p></body></html>
	"""
	frappe.local.response.filename = f"wallet-request-{doc.name}.pdf"
	frappe.local.response.filecontent = get_pdf(html)
	frappe.local.response.type = "download"
