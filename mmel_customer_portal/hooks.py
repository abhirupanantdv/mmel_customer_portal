app_name = "mmel_customer_portal"
app_title = "MMEL Customer Portal"
app_publisher = "MH Money Express"
app_description = "Customer self-service portal for the existing Moneygram ERPNext app"
app_email = ""
app_license = "Proprietary"

required_apps = ["erpnext", "moneygram"]

# React Router owns every route below /customer-portal. Frappe always serves the
# same generated page, including on refresh of a nested client-side route.
website_route_rules = [
	{"from_route": "/customer-portal", "to_route": "customer_portal"},
	{"from_route": "/customer-portal/<path:app_path>", "to_route": "customer_portal"},
]

# Preserve verification links printed before the portal gained its Frappe path.
website_redirects = [
	{"source": r"^/verify-card/(.*)$", "target": r"/customer-portal/verify-card/\1"},
]
