import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const outputPath = path.join(__dirname, 'kline-data.js')
const symbol = 'AAPL'
const yahooChartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5y&interval=1d&includeAdjustedClose=true`

const response = await fetch(yahooChartUrl)
if (!response.ok) {
  throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`)
}

const payload = await response.json()
const result = payload?.chart?.result?.[0]
if (!result) {
  throw new Error('Yahoo Finance response missing result data')
}

const timestamps = result.timestamp ?? []
const quote = result.indicators?.quote?.[0] ?? {}
const opens = quote.open ?? []
const highs = quote.high ?? []
const lows = quote.low ?? []
const closes = quote.close ?? []
const volumes = quote.volume ?? []

const roundPrice = (value) => {
  if (value === null || value === undefined) {
    return null
  }
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return null
  }
  return Number.parseFloat(numericValue.toFixed(2))
}

const candles = []
for (let index = 0; index < timestamps.length; index += 1) {
  const timestampSecRaw = timestamps[index]
  const timestampSec = Number(timestampSecRaw)
  const open = roundPrice(opens[index])
  const high = roundPrice(highs[index])
  const low = roundPrice(lows[index])
  const close = roundPrice(closes[index])
  const volumeRaw = Number(volumes[index])

  if (!Number.isFinite(timestampSec)) {
    continue
  }

  const hasValidPrices = [open, high, low, close].every(value => value !== null)
  if (!hasValidPrices) {
    continue
  }

  const volume = Number.isFinite(volumeRaw) ? Math.round(volumeRaw) : 0
  candles.push({
    timestamp: timestampSec * 1000,
    open,
    high,
    low,
    close,
    volume,
  })
}

candles.sort((a, b) => a.timestamp - b.timestamp)

if (candles.length === 0) {
  throw new Error('No valid candles generated from Yahoo Finance data')
}

const content = `window.demoCandles = ${JSON.stringify(candles, null, 2)};\n`
fs.writeFileSync(outputPath, content)

const firstDate = new Date(candles[0].timestamp).toISOString().slice(0, 10)
const lastDate = new Date(candles[candles.length - 1].timestamp).toISOString().slice(0, 10)
console.log(`Generated ${candles.length} daily candles for ${symbol} covering ${firstDate} to ${lastDate}`)
