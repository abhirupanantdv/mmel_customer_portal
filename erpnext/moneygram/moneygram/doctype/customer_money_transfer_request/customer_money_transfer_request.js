frappe.ui.form.on('Customer Money Transfer Request', {
  refresh(frm) {
    if (!frm.is_new() && ['Pending', 'In Review', 'Approved'].includes(frm.doc.status)) {
      frm.add_custom_button(__('Start Operator Review'), () => {
        frm.set_value('status', 'In Review')
        frm.save()
      }, __('Operator Actions'))
    }
  },
})
