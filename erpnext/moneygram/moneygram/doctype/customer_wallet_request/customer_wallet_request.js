frappe.ui.form.on('Customer Wallet Request', {
  refresh(frm) {
    if (frm.is_new() || ['Completed', 'Rejected', 'Cancelled'].includes(frm.doc.status)) return

    frm.add_custom_button(__('Approve and Post'), () => {
      frappe.call({
        method: 'moneygram.moneygram.api.customer_portal_wallet.approve_request',
        args: { request_id: frm.doc.name },
        freeze: true,
        callback: () => frm.reload_doc(),
      })
    }, __('Operator Actions'))

    frm.add_custom_button(__('Reject'), () => {
      frappe.prompt({ fieldname: 'remarks', fieldtype: 'Small Text', label: __('Reason'), reqd: 1 }, (values) => {
        frappe.call({
          method: 'moneygram.moneygram.api.customer_portal_wallet.reject_request',
          args: { request_id: frm.doc.name, remarks: values.remarks },
          freeze: true,
          callback: () => frm.reload_doc(),
        })
      }, __('Reject Wallet Request'))
    }, __('Operator Actions'))
  },
})
