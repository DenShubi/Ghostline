const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const count = new Intl.NumberFormat('en-US')

export const formatUSD = (value) => usd.format(value)
export const formatCount = (value) => count.format(value)
