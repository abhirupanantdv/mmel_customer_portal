frappe.ui.form.on('Customer Membership Card', {
  refresh(frm) {
    if (frm.is_new()) return

    if (frm.doc.profile_review_status === 'Pending') {
      frm.add_custom_button(__('Approve Profile'), () => {
        frm.set_value('profile_review_status', 'Approved')
        frm.save()
      }, __('Operator Actions'))
    }

    if (frm.doc.profile_review_status === 'Approved' && frm.doc.card_review_status === 'Pending') {
      frm.add_custom_button(__('Approve Card'), () => {
        frm.set_value('card_review_status', 'Approved')
        frm.save()
      }, __('Operator Actions'))
    }

    if (frm.doc.status !== 'Active') {
      frm.add_custom_button(__('Reject'), () => {
        frappe.prompt({ fieldname: 'remarks', fieldtype: 'Small Text', label: __('Reason'), reqd: 1 }, (values) => {
          frm.set_value('operator_remarks', values.remarks)
          frm.set_value(frm.doc.profile_review_status === 'Approved' ? 'card_review_status' : 'profile_review_status', 'Rejected')
          frm.save()
        }, __('Reject Membership'))
      }, __('Operator Actions'))
    }
  },
})
