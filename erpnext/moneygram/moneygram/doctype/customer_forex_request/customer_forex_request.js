frappe.ui.form.on('Customer Forex Request', {
  refresh(frm) {
    if (!frm.is_new() && ['Pending', 'In Review', 'Approved'].includes(frm.doc.status)) {
      frm.add_custom_button(__('Create Currency Exchange'), () => {
        frappe.new_doc('Currency Exchange For Customer', {
          customer_id: frm.doc.customer,
          customer_full_name: frm.doc.customer_name,
          warehouse: frm.doc.warehouse,
          // Currency Exchange uses the company's perspective: when the
          // customer buys foreign currency, the company records a SELL.
          exchange_type: frm.doc.request_type === 'BUY' ? 'SELL' : 'BUY',
          total_foreign_currency: frm.doc.foreign_amount,
          send_or_receive_currency: frm.doc.foreign_currency,
          final_amount: frm.doc.estimated_total,
          remarks: `Customer portal request ${frm.doc.name}`,
        })
      }, __('Operator Actions'))
    }
    if (frm.doc.currency_exchange) {
      frm.add_custom_button(__('Open Currency Exchange'), () => {
        frappe.set_route('Form', 'Currency Exchange For Customer', frm.doc.currency_exchange)
      }, __('Operator Actions'))
    }
  },
})
