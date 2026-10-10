export const nouns = {
  customers: ['customer', 'customers'], orders: ['order', 'orders'], products: ['item', 'items'],
  payments: ['payment', 'payments'], users: ['team member', 'team members'],
  movements: ['stock movement', 'stock movements'], audit: ['audit event', 'audit events']
};

export function countLabel(total, context) {
  const [singular, plural] = nouns[context];
  return `${total} ${total === 1 ? singular : plural}`;
}

export function pagination(data, context, previous = 'previous', next = 'next') {
  return `<div class="pagination"><span>${countLabel(data.total, context)} · Page ${data.page} of ${Math.max(1, Math.ceil(data.total / data.limit))}</span><div><button id="${previous}" ${data.page <= 1 ? 'disabled' : ''}>Previous</button><button id="${next}" ${data.page * data.limit >= data.total ? 'disabled' : ''}>Next</button></div></div>`;
}
