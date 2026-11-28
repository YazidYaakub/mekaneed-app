import { copyFile, mkdir, rm } from 'node:fs/promises'

const output = new URL('./dist/', import.meta.url)
const assets = ['index.html', 'styles.css', 'app.mjs', 'review.mjs', 'comparison.mjs', 'quotation-input.mjs']

await rm(output, { recursive: true, force: true })
await mkdir(output)
await Promise.all(assets.map(asset => copyFile(new URL(asset, import.meta.url), new URL(asset, output))))
