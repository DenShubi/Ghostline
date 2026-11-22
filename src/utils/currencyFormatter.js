const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const count = new Intl.NumberFormat('en-US')

export const formatUSD = (value) => usd.format(value)
export const formatUSDWhole = (value) => usdWhole.format(value)
export const formatCount = (value) => count.format(value)

/** +130.5% / −4.8% / 0% */
export function formatMarkup(percent) {
  if (percent == null) return '—'
  if (percent === 0) return '0%'
  return `${percent > 0 ? '+' : '−'}${Math.abs(percent).toFixed(1).replace(/\.0$/, '')}%`
}
