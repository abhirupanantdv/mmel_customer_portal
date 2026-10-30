from setuptools import find_packages, setup

from mmel_customer_portal import __version__


setup(
	name="mmel_customer_portal",
	version=__version__,
	description="MH Money Express customer portal for ERPNext",
	author="MH Money Express",
	author_email="",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
)
