"""Portal membership identity, photo, approval status, and printable card APIs."""

from __future__ import annotations

import base64
import io
import mimetypes
import os

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import get_url
from frappe.utils.file_manager import save_file

from moneygram.moneygram.api.customer_portal_auth import _customer_for_user
from moneygram.moneygram.api.customer_portal_profile import PORTAL_DOCUMENT_TYPES, _ensure_document_type
from moneygram.moneygram.doctype.customer_membership_card.customer_membership_card import normalise_card_number


MAX_PHOTO_SIZE = 10 * 1024 * 1024
PHOTO_EXTENSIONS = {".png", ".jpg", ".jpeg"}
DEFAULT_SUPPLIER_GROUP = "Local"
PORTAL_CARD_VERIFICATION_ROUTE = "/customer-portal/verify-card"


def _company_contact() -> dict:
	company_name = frappe.defaults.get_global_default("company") or frappe.db.get_single_value("Global Defaults", "default_company")
	if not company_name:
		company_name = frappe.db.get_value("Company", {}, "name")
	if not company_name:
		return {"company_name": "MH Money Express", "phone": "", "email": "", "website": ""}
	company = frappe.db.get_value(
		"Company",
		company_name,
		["company_name", "phone_no", "email", "website"],
		as_dict=True,
	)
	return {
		"company_name": (company.company_name or company_name).strip(),
		"phone": (company.phone_no or "").strip(),
		"email": (company.email or "").strip(),
		"website": (company.website or "").strip(),
	}


def _require_identity():
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.AuthenticationError)
	customer_name = _customer_for_user(frappe.session.user)
	if not customer_name:
		frappe.throw(_("No customer profile is linked to this account."), frappe.PermissionError)
	return frappe.get_doc("User", frappe.session.user), frappe.get_doc("Customer", customer_name)


def _contact_for_user(user: str):
	contact = frappe.db.get_value("Contact", {"user": user}, "name")
	return frappe.get_doc("Contact", contact) if contact else None


def ensure_supplier(customer, user: str) -> str:
	"""Create the matching Individual Supplier and link the same portal Contact."""
	if frappe.db.exists("Supplier", customer.name):
		supplier_name = customer.name
	else:
		if not frappe.db.exists("Supplier Group", DEFAULT_SUPPLIER_GROUP):
			frappe.throw(_("The Local supplier group is not configured."), frappe.ValidationError)
		supplier = frappe.get_doc(
			{
				"doctype": "Supplier",
				"supplier_name": customer.name,
				"supplier_group": DEFAULT_SUPPLIER_GROUP,
				"supplier_type": "Individual",
				"custom_full_name": customer.get("custom_full_name") or customer.customer_name,
				"custom_first_name": customer.get("custom_first_name"),
				"custom_middle_name": customer.get("custom_middle_name"),
				"custom_last_name": customer.get("custom_last_name"),
			}
		).insert(ignore_permissions=True)
		if supplier.name != customer.name:
			frappe.throw(_("Supplier ID {0} does not match Customer ID {1}.").format(supplier.name, customer.name))
		supplier_name = supplier.name

	contact = _contact_for_user(user)
	if contact and not frappe.db.exists(
		"Dynamic Link",
		{"parent": contact.name, "parenttype": "Contact", "link_doctype": "Supplier", "link_name": supplier_name},
	):
		contact.append("links", {"link_doctype": "Supplier", "link_name": supplier_name})
		contact.save(ignore_permissions=True)
	return supplier_name


def _latest_photo(customer: str, verified_only: bool = False) -> str | None:
	filters = {"customer": customer, "document_type": "CUSTOMER_PHOTO"}
	if verified_only:
		filters["status"] = "Verified"
	return frappe.db.get_value(
		"Customer Portal KYC Document",
		filters,
		"attachment",
		order_by="creation desc",
	)


def ensure_membership(customer, user: str):
	supplier = ensure_supplier(customer, user)
	card_name = frappe.db.get_value("Customer Membership Card", {"customer": customer.name}, "name")
	if card_name:
		card = frappe.get_doc("Customer Membership Card", card_name)
	else:
		card = frappe.get_doc(
			{
				"doctype": "Customer Membership Card",
				"customer": customer.name,
				"supplier": supplier,
				"portal_user": user,
				"cardholder_name": customer.get("custom_full_name") or customer.customer_name,
				"photo": _latest_photo(customer.name),
			}
		).insert(ignore_permissions=True)

	card_number = normalise_card_number(card.card_number)
	if card.card_number != card_number:
		card.db_set("card_number", card_number, update_modified=False)
		card.card_number = card_number
	if not card.verification_token:
		verification_token = frappe.generate_hash(length=32)
		card.db_set("verification_token", verification_token, update_modified=False)
		card.verification_token = verification_token

	photo = _latest_photo(customer.name, verified_only=card.status == "Active")
	if photo and card.photo != photo:
		card.db_set("photo", photo, update_modified=False)
		card.photo = photo
	cardholder_name = customer.get("custom_full_name") or customer.customer_name
	if card.cardholder_name != cardholder_name:
		card.db_set("cardholder_name", cardholder_name, update_modified=False)
		card.cardholder_name = cardholder_name
	return card


def create_membership_for_signup(customer, user: str):
	"""Internal signup hook; transaction rolls back with signup if creation fails."""
	return ensure_membership(customer, user)


def _card_payload(card) -> dict:
	verification_url = get_url(f"{PORTAL_CARD_VERIFICATION_ROUTE}/{card.verification_token}")
	return {
		"card_number": card.card_number,
		"record_id": card.name,
		"status": card.status,
		"profile_review_status": card.profile_review_status,
		"card_review_status": card.card_review_status,
		"customer_id": card.customer,
		"supplier_id": card.supplier,
		"cardholder_name": card.cardholder_name,
		"has_photo": bool(card.photo),
		"photo_data_uri": _photo_data_uri(card.photo),
		"submitted_on": card.submitted_on,
		"issued_on": card.issued_on,
		"valid_until": card.valid_until,
		"operator_remarks": card.operator_remarks if card.status == "Rejected" else "",
		"can_download": card.status == "Active",
		"verification_url": verification_url,
		"qr_data_uri": _qr_data_uri(verification_url),
		"company_contact": _company_contact(),
	}


@frappe.whitelist(methods=["POST"])
def get_card() -> dict:
	user, customer = _require_identity()
	return _card_payload(ensure_membership(customer, user.name))


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=10, seconds=60 * 60)
def upload_photo() -> dict:
	user, customer = _require_identity()
	uploaded = frappe.request.files.get("file") if getattr(frappe, "request", None) else None
	if not uploaded or not uploaded.filename:
		frappe.throw(_("Choose or capture a photograph."), frappe.ValidationError)
	extension = os.path.splitext(uploaded.filename.lower())[1]
	if extension not in PHOTO_EXTENSIONS:
		frappe.throw(_("Only PNG, JPG, and JPEG photographs are allowed."), frappe.ValidationError)
	content = uploaded.read()
	if not content or len(content) > MAX_PHOTO_SIZE:
		frappe.throw(_("The photograph must be between 1 byte and 10 MB."), frappe.ValidationError)

	_ensure_document_type("CUSTOMER_PHOTO")
	file_doc = save_file(uploaded.filename, content, "Customer", customer.name, is_private=1)
	evidence = frappe.get_doc(
		{
			"doctype": "Customer Portal KYC Document",
			"customer": customer.name,
			"membership_card": ensure_membership(customer, user.name).name,
			"document_type": "CUSTOMER_PHOTO",
			"document_category": "Photo",
			"document_name": PORTAL_DOCUMENT_TYPES["CUSTOMER_PHOTO"],
			"document_label": PORTAL_DOCUMENT_TYPES["CUSTOMER_PHOTO"],
			"attachment": file_doc.file_url,
			"status": "Draft",
		}
	).insert(ignore_permissions=True)
	frappe.db.set_value(
		"File",
		file_doc.name,
		{"attached_to_doctype": "Customer Portal KYC Document", "attached_to_name": evidence.name, "attached_to_field": "attachment"},
		update_modified=False,
	)
	card = ensure_membership(customer, user.name)
	card.update(
		{
			"photo": file_doc.file_url,
			"profile_review_status": "Pending",
			"card_review_status": "Pending",
		}
	)
	card.save(ignore_permissions=True)
	return _card_payload(card)


def _photo_data_uri(photo_url: str | None) -> str:
	if not photo_url:
		return ""
	file_name = frappe.db.get_value("File", {"file_url": photo_url}, "name")
	if not file_name:
		return ""
	content = frappe.get_doc("File", file_name).get_content()
	mime = mimetypes.guess_type(photo_url)[0] or "image/jpeg"
	return f"data:{mime};base64,{base64.b64encode(content).decode()}"


def _qr_data_uri(value: str) -> str:
	import pyqrcode

	stream = io.BytesIO()
	pyqrcode.create(value, error="M").svg(stream, scale=5, quiet_zone=1, background="#ffffff")
	return f"data:image/svg+xml;base64,{base64.b64encode(stream.getvalue()).decode()}"


def _asset_data_uri(filename: str) -> str:
	path = frappe.get_app_path("moneygram", "public", "images", filename)
	mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
	with open(path, "rb") as asset:
		return f"data:{mime};base64,{base64.b64encode(asset.read()).decode()}"


@frappe.whitelist(allow_guest=True, methods=["GET"])
def verify_card(token: str) -> dict:
	token = (token or "").strip()
	if len(token) != 32:
		frappe.throw(_("Membership card was not found."), frappe.DoesNotExistError)
	name = frappe.db.get_value("Customer Membership Card", {"verification_token": token}, "name")
	if not name:
		frappe.throw(_("Membership card was not found."), frappe.DoesNotExistError)
	card = frappe.get_doc("Customer Membership Card", name)
	return {
		"valid": card.status == "Active",
		"status": card.status,
		"card_number": card.card_number,
		"cardholder_name": card.cardholder_name,
		"valid_until": card.valid_until,
	}


def _card_pdf(card) -> bytes:
	"""Render two exact card-sized pages without browser print scaling or overlap."""
	from PIL import Image, ImageDraw, ImageFont, ImageOps

	card_width, card_height = 1016, 638  # 86 x 54 mm at 300 DPI
	mm = card_width / 86
	font_root = "/usr/share/fonts/truetype/dejavu"

	def font(filename: str, size: int):
		return ImageFont.truetype(os.path.join(font_root, filename), size)

	def point(value: float) -> int:
		return round(value * mm)

	def template(filename: str):
		path = frappe.get_app_path("moneygram", "public", "images", filename)
		return Image.open(path).convert("RGB").resize((card_width, card_height), Image.Resampling.LANCZOS)

	front = template("membership-card-front-template.png")
	back = template("membership-card-back-template.png")
	front_draw = ImageDraw.Draw(front)
	back_draw = ImageDraw.Draw(back)
	ink = "#121722"
	muted = "#59616b"

	if card.photo:
		file_name = frappe.db.get_value("File", {"file_url": card.photo}, "name")
		if file_name:
			photo = Image.open(io.BytesIO(frappe.get_doc("File", file_name).get_content())).convert("RGB")
			photo = ImageOps.fit(photo, (point(15), point(18.5)), method=Image.Resampling.LANCZOS)
			border = point(1.1)
			x, y = point(64.8), point(14.7)
			front_draw.rounded_rectangle((x - border, y - border, x + photo.width + border, y + photo.height + border), radius=point(2), fill="white")
			front.paste(photo, (x, y))

	qr_stream = io.BytesIO()
	import pyqrcode
	pyqrcode.create(get_url(f"{PORTAL_CARD_VERIFICATION_ROUTE}/{card.verification_token}"), error="M").png(qr_stream, scale=8, quiet_zone=1)
	qr = Image.open(io.BytesIO(qr_stream.getvalue())).convert("RGB").resize((point(13), point(13)), Image.Resampling.NEAREST)
	qr_x, qr_y = point(66), point(34.4)
	front_draw.rectangle((qr_x - point(.5), qr_y - point(.5), qr_x + qr.width + point(.5), qr_y + qr.height + point(.5)), fill="white")
	front.paste(qr, (qr_x, qr_y))
	qr_label = "SCAN FOR SERVICES"
	qr_label_font = font("DejaVuSans.ttf", 14)
	label_box = front_draw.textbbox((0, 0), qr_label, font=qr_label_font)
	front_draw.text((qr_x + (qr.width - (label_box[2] - label_box[0])) / 2, point(48.3)), qr_label, fill=ink, font=qr_label_font)

	formatted_number = " ".join(card.card_number[index:index + 4] for index in range(0, len(card.card_number), 4))
	front_draw.text((point(5.5), point(29.2)), formatted_number, fill=ink, font=font("DejaVuSansMono-Bold.ttf", 43))
	front_draw.text((point(5.5), point(36)), "CUSTOMER NAME", fill=muted, font=font("DejaVuSans.ttf", 14))
	front_draw.text((point(5.5), point(38.1)), (card.cardholder_name or "").upper(), fill=ink, font=font("DejaVuSans-Bold.ttf", 25))
	front_draw.text((point(5.5), point(44.4)), "CUSTOMER ID", fill=muted, font=font("DejaVuSans.ttf", 14))
	front_draw.text((point(5.5), point(47)), card.customer, fill=ink, font=font("DejaVuSans-Bold.ttf", 20))
	front_draw.text((point(29), point(44.4)), "VALID THRU", fill=muted, font=font("DejaVuSans.ttf", 14))
	valid_until = card.valid_until.strftime("%m/%Y") if card.valid_until else "PENDING"
	front_draw.text((point(29), point(47)), valid_until, fill=ink, font=font("DejaVuSans-Bold.ttf", 20))

	company = _company_contact()
	panel = (point(53), point(36.1), point(81.5), point(51.3))
	back_draw.rounded_rectangle(panel, radius=point(1), fill="#ffffff")
	x, y = point(54.5), point(37.2)
	back_draw.text((x, y), company["company_name"], fill="#a70a14", font=font("DejaVuSans-Bold.ttf", 15))
	for value in (company["phone"], company["email"], company["website"]):
		if value:
			y += point(3.2)
			back_draw.text((x, y), value, fill=ink, font=font("DejaVuSans.ttf", 14))

	stream = io.BytesIO()
	front.save(stream, format="PDF", resolution=300.0, save_all=True, append_images=[back])
	return stream.getvalue()


@frappe.whitelist(methods=["GET"])
def download_card_pdf():
	user, customer = _require_identity()
	card = ensure_membership(customer, user.name)
	if card.status != "Active":
		frappe.throw(_("The membership card will be available after operator approval."), frappe.PermissionError)
	frappe.local.response.filename = f"{card.card_number}.pdf"
	frappe.local.response.filecontent = _card_pdf(card)
	frappe.local.response.type = "download"
