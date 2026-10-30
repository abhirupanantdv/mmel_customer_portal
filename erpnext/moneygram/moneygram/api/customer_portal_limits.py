"""Customer exchange-control limits sourced from the RBF policy effective 1 January 2026."""

from __future__ import annotations

from datetime import date
from typing import Optional

import frappe
from frappe import _
from frappe.utils import flt, getdate, today

from moneygram.moneygram.api.customer_portal_auth import _customer_for_user


POLICY = {
	"title": "RBF Exchange Control Policy 2026",
	"effective_from": "2026-01-01",
	"source": "Reserve Bank of Fiji — Exchange Control Policy Effective from 1 January 2026",
}

RULES = [
	{"code": "RBF26-CC-PERSONAL", "category": "Cards", "label": "Personal credit-card repayment", "limit": 10000, "period": "month", "basis": "per cardholder", "page": 3, "requirements": ["Credit-card statement or statement of account", "Tax clearance for repayments above F$20,000 per month"], "notes": ["Monthly top-up allowance is F$5,000.", "Cards must not be used to acquire offshore real, financial or virtual assets."]},
	{"code": "RBF26-CASH-DRAWING", "category": "Cards", "label": "Credit-card cash drawing", "limit": 1500, "period": "month", "basis": "per cardholder", "page": 3, "requirements": ["Credit-card statement or statement of account"], "notes": ["Forms part of the applicable credit-card controls."]},
	{"code": "RBF26-DEBIT-OVERSEAS", "category": "Cards", "label": "Debit-card overseas usage", "limit": 5000, "period": "month", "basis": "per account", "page": 3, "requirements": ["Requests above the monthly limit must be referred through the issuing commercial bank", "Tax clearance above F$20,000 per annum"], "notes": ["Applies to foreign-currency transactions online and offshore.", "Cards must not be used to acquire offshore real, financial or virtual assets."]},
	{"code": "RBF26-GIFT", "category": "Personal remittance", "label": "Gift", "limit": 2000, "period": "year", "basis": "per applicant / beneficiary", "page": 5, "requirements": ["TIN letter or FRCS joint card where applicable"], "notes": ["Higher amounts require RBF approval and supporting beneficiary, tax, gift and relationship evidence."]},
	{"code": "RBF26-EMIGRATION", "category": "Personal remittance", "label": "Emigration allowance", "limit": 250000, "period": "year", "basis": "per family", "page": 6, "requirements": ["TIN letter or FRCS joint card where applicable", "Valid passports and qualifying residence visas", "Tax clearance above F$20,000 unless the stated exemption applies"], "notes": ["All foreign-currency facilities issued form part of the emigration allowance."]},
	{"code": "RBF26-EDU-INSTITUTION", "category": "Education", "label": "Education paid to institution", "limit": 100000, "period": "year", "basis": "per student", "page": 6, "requirements": ["Current invoice, enrolment or offer letter, or confirmation of admission"], "notes": ["Third-party payments must be reflected in the institution invoice."]},
	{"code": "RBF26-EDU-STUDENT", "category": "Education", "label": "Education paid to student or nominee", "limit": 50000, "period": "year", "basis": "per student", "page": 6, "requirements": ["Current enrolment, offer or confirmation letter", "Rental agreement for direct landlord payments", "Nominee PR visa or foreign passport where applicable"], "notes": []},
	{"code": "RBF26-MAINTENANCE", "category": "Personal remittance", "label": "Maintenance", "limit": 2000, "period": "year", "basis": "per applicant / beneficiary", "page": 10, "requirements": ["TIN letter or FRCS joint card where applicable"], "notes": ["Amounts above the delegated limit require beneficiary passport/residence evidence, tax clearance where applicable, and relationship evidence."]},
	{"code": "RBF26-MISC", "category": "Personal remittance", "label": "Miscellaneous personal expenses", "limit": 500, "period": "year", "basis": "per applicant", "page": 10, "requirements": ["TIN letter or FRCS joint card where applicable"], "notes": []},
	{"code": "RBF26-MED-INSTITUTION", "category": "Medical", "label": "Medical expenses paid to institution", "limit": 100000, "period": "invoice", "basis": "per invoice", "page": 11, "requirements": ["TIN letter or FRCS joint card where applicable", "Current invoice or letter from the medical institution stating the amount due"], "notes": []},
	{"code": "RBF26-MED-PATIENT", "category": "Medical", "label": "Medical expenses paid to patient or nominee", "limit": 50000, "period": "application", "basis": "patient / nominee per annum", "page": 11, "requirements": ["TIN letter or FRCS joint card where applicable", "Current invoice or medical-institution letter", "Medical or valid visa"], "notes": ["Carrying foreign currency above the delegated travel-funds limit requires RBF approval."]},
	{"code": "RBF26-NR-FAMILY", "category": "Non-resident transfer", "label": "Non-resident transfer to family offshore", "limit": 2000, "period": "year", "basis": "per applicant / beneficiary", "page": 11, "requirements": ["TIN letter or FRCS joint card"], "notes": ["Applies to foreign-passport holders permitted to reside or work in Fiji; excludes external-account transfers."]},
	{"code": "RBF26-NR-OWN", "category": "Non-resident transfer", "label": "Non-resident transfer to own offshore account", "limit": 250000, "period": "year", "basis": "per family", "page": 11, "requirements": ["TIN letter or FRCS joint card", "Valid foreign passport where applicable", "Tax clearance above F$20,000 per annum"], "notes": ["Only applies to qualifying dual/foreign passport holders maintaining resident accounts in Fiji."]},
	{"code": "RBF26-TRAVEL-FJ-RETURN", "category": "Travel", "label": "Travel — Fiji passport, return ticket", "limit": 10000, "period": "trip", "basis": "per person", "page": 15, "requirements": ["TIN letter or FRCS joint card where applicable", "Return travel ticket to Fiji", "Original passport"], "notes": ["Funds may not be issued more than one month before departure."]},
	{"code": "RBF26-TRAVEL-FJ-ONEWAY", "category": "Travel", "label": "Travel — Fiji passport, one-way ticket", "limit": 5000, "period": "trip", "basis": "per person", "page": 15, "requirements": ["TIN letter or FRCS joint card where applicable", "One-way ticket", "Original passport"], "notes": ["Emigrants are governed by the emigration allowance instead."]},
	{"code": "RBF26-TRAVEL-FP-RETURN", "category": "Travel", "label": "Travel — foreign passport, resident account, return ticket", "limit": 10000, "period": "trip", "basis": "per person", "page": 16, "requirements": ["TIN letter or FRCS joint card", "Return travel ticket to Fiji", "Original passport"], "notes": []},
	{"code": "RBF26-TRAVEL-FP-ONEWAY", "category": "Travel", "label": "Travel — foreign passport, resident account, one-way ticket", "limit": 5000, "period": "trip", "basis": "per person", "page": 16, "requirements": ["TIN letter or FRCS joint card", "One-way ticket", "Original passport"], "notes": []},
]
RULES_BY_CODE = {rule["code"]: rule for rule in RULES}


def _require_customer():
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	customer = _customer_for_user(frappe.session.user)
	if not customer:
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)
	return frappe.get_doc("Customer", customer)


def _period_key(rule: dict, current: date) -> Optional[str]:
	if rule["period"] == "year":
		return str(current.year)
	if rule["period"] == "month":
		return current.strftime("%Y-%m")
	return None


@frappe.whitelist(methods=["GET"])
def get_my_limits() -> dict:
	customer = _require_customer()
	current = getdate(today())
	usage_rows = frappe.get_all(
		"Customer Exchange Control Usage",
		filters={"customer": customer.name, "portal_user": frappe.session.user},
		fields=["name", "rule_code", "period_key", "usage_state", "amount_fjd", "transaction_date", "source_doctype", "source_name"],
		order_by="transaction_date desc, creation desc",
		limit_page_length=5000,
		ignore_permissions=True,
	)
	result = []
	for rule in RULES:
		key = _period_key(rule, current)
		matching = [row for row in usage_rows if row.rule_code == rule["code"] and (key is None or row.period_key == key)]
		completed = flt(sum(flt(row.amount_fjd) for row in matching if row.usage_state == "Completed"), 2)
		pending = flt(sum(flt(row.amount_fjd) for row in matching if row.usage_state == "Pending"), 2)
		cumulative = key is not None
		available = max(flt(rule["limit"], 2) - completed - pending, 0) if cumulative else None
		result.append({**rule, "currency": "FJD", "period_key": key, "completed": completed, "pending": pending, "available": available, "cumulative": cumulative, "record_count": len(matching)})

	return {
		"policy": POLICY,
		"customer": customer.name,
		"as_of": today(),
		"ledger_entries": len(usage_rows),
		"rules": result,
		"recent_usage": usage_rows[:20],
		"disclaimer": _("A delegated limit is not an automatic approval. Eligibility, documents, purpose, beneficiary basis, tax clearance, prior usage and any Reserve Bank approval must be checked by an authorised dealer."),
	}
