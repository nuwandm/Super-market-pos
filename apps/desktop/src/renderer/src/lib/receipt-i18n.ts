export type DocLang = 'en' | 'si' | 'ta'

export interface DocLabels {
  receipt: string
  invoice: string
  returnReceipt: string
  subtotal: string
  discount: string
  tax: string
  total: string
  cash: string
  card: string
  mobilePay: string
  change: string
  qty: string
  unitPrice: string
  amount: string
  cashier: string
  thankYou: string
  vatNumber: string
  items: string
}

export const DOC_LABELS: Record<DocLang, DocLabels> = {
  en: {
    receipt:      'RECEIPT',
    invoice:      'INVOICE',
    returnReceipt: 'RETURN RECEIPT',
    subtotal:     'Subtotal',
    discount:     'Discount',
    tax:          'Tax (VAT)',
    total:        'TOTAL',
    cash:         'Cash',
    card:         'Card',
    mobilePay:    'Mobile Pay',
    change:       'Change',
    qty:          'Qty',
    unitPrice:    'Unit Price',
    amount:       'Amount',
    cashier:      'Cashier',
    thankYou:     'Thank you for shopping with us!',
    vatNumber:    'VAT No.',
    items:        'Items',
  },
  si: {
    receipt:      '\u0dbb\u0dd2\u0dc3\u0dd2\u0da7\u0dca\u0db4\u0dad',
    invoice:      '\u0d89\u0db1\u0dca\u0dc0\u0ddd\u0dba\u0dd2\u0dc3\u0dba',
    returnReceipt: '\u0d86\u0db4\u0dc3\u0dd4 \u0dbb\u0dd2\u0dc3\u0dd2\u0da7\u0dca\u0db4\u0dad',
    subtotal:     '\u0d8b\u0db4 \u0d91\u0d9a\u0dad\u0dd4\u0dc0',
    discount:     '\u0dc0\u0da7\u0dca\u0da7\u0db8',
    tax:          'VAT \u0db6\u0daf\u0dd4',
    total:        '\u0d91\u0d9a\u0dad\u0dd4\u0dc0',
    cash:         '\u0db8\u0dd4\u0daf\u0dbd\u0dca',
    card:         '\u0d9a\u0dcf\u0da9\u0dca',
    mobilePay:    '\u0da2\u0d82\u0d9c\u0db8 \u0d9c\u0dd9\u0dc0\u0dd3\u0db8',
    change:       '\u0d89\u0dad\u0dd2\u0dbb\u0dd2\u0dba',
    qty:          '\u0db4.\u0d9c\u0dab\u0db1',
    unitPrice:    '\u0d91\u0d9a\u0d9a \u0db8\u0dd2\u0dbd',
    amount:       '\u0db8\u0dd4\u0daf\u0dbd',
    cashier:      '\u0d85\u0dc0\u0dca\u200d\u0dba\u0dcf',
    thankYou:     '\u0d85\u0db4\u0dda \u0dc3\u0dcf\u0db4\u0dca\u0db4\u0dd4\u0dc0\u0dd9 \u0d9a\u0dd2\u0dbb\u0dd3\u0db8\u0da7 \u0dc3\u0dca\u0dad\u0dd6\u0dad\u0dd2\u0dba\u0dd2!',
    vatNumber:    'VAT \u0d85\u0d82\u0d9a\u0dba',
    items:        '\u0d86\u0dba\u0dd2\u0dad\u0db8',
  },
  ta: {
    receipt:      '\u0bb0\u0b9a\u0bc0\u0ba4\u0bc1',
    invoice:      '\u0bb5\u0bbf\u0bb2\u0bc8\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0bbf\u0baf\u0bb2\u0bcd',
    returnReceipt: '\u0ba4\u0bbf\u0bb0\u0bc1\u0bae\u0bcd\u0baa \u0bb0\u0b9a\u0bc0\u0ba4\u0bc1',
    subtotal:     '\u0b95\u0bc2\u0b9f\u0bcd\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bc6\u0bbe\u0b95\u0bc8',
    discount:     '\u0ba4\u0bb3\u0bcd\u0bb3\u0bc1\u0baa\u0b9f\u0bbf',
    tax:          'VAT \u0bb5\u0bb0\u0bbf',
    total:        '\u0bae\u0bca\u0ba4\u0bcd\u0ba4\u0bae\u0bcd',
    cash:         '\u0baa\u0ba3\u0bae\u0bcd',
    card:         '\u0b95\u0bbe\u0bb0\u0bcd\u0b9f\u0bc1',
    mobilePay:    '\u0bae\u0bca\u0baa\u0bc8\u0bb2\u0bcd \u0baa\u0ba3\u0bae\u0bcd',
    change:       '\u0bae\u0bc0\u0ba4\u0bbf',
    qty:          '\u0b8e\u0ba3\u0bcd\u0ba3\u0bbf\u0b95\u0bcd\u0b95\u0bc8',
    unitPrice:    '\u0b92\u0bb0\u0bc1 \u0baa\u0bca\u0bb0\u0bc1\u0bb3\u0bcd \u0bb5\u0bbf\u0bb2\u0bc8',
    amount:       '\u0ba4\u0bca\u0b95\u0bc8',
    cashier:      '\u0b95\u0bbe\u0b9a\u0bbe\u0bb3\u0bb0\u0bcd',
    thankYou:     '\u0b8e\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0b95\u0b9f\u0bc8\u0baf\u0bbf\u0bb2\u0bcd \u0bb5\u0bbe\u0b99\u0bcd\u0b95\u0bbf\u0baf\u0ba4\u0bb1\u0bcd\u0b95\u0bc1 \u0ba8\u0ba9\u0bcd\u0bb1\u0bbf!',
    vatNumber:    'VAT \u0b8e\u0ba3\u0bcd',
    items:        '\u0baa\u0bca\u0bb0\u0bc1\u0b9f\u0bcd\u0b95\u0bb3\u0bcd',
  },
}

export function getDocLabels(lang?: string | null): DocLabels {
  return DOC_LABELS[(lang ?? 'en') as DocLang] ?? DOC_LABELS.en
}
