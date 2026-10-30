frappe.ui.form.on('Customer Portal KYC Document', {
  refresh(frm) {
    if (frm.is_new() || frm.doc.status !== 'Draft') return
    frm.add_custom_button(__('Verify Document'), () => {
      frm.set_value('status', 'Verified')
      frm.save()
    }, __('Operator Actions'))
    frm.add_custom_button(__('Reject Document'), () => {
      frappe.prompt({ fieldname: 'remarks', fieldtype: 'Small Text', label: __('Reason'), reqd: 1 }, (values) => {
        frm.set_value('review_remarks', values.remarks)
        frm.set_value('status', 'Rejected')
        frm.save()
      }, __('Reject Document'))
    }, __('Operator Actions'))
  },
})
