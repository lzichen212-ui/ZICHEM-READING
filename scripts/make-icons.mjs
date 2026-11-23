import zlib from 'node:zlib'
import fs from 'node:fs'

/* 不依赖任何三方库，直接生成 PWA 需要的 PNG 图标 */

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

const crc32 = buf => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

const png = (size, pixels) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function draw(size) {
  const px = Buffer.alloc(size * size * 4)
  const S = size / 512
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = a
  }
  const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x
    const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r)
  }
  const rect = (x0, y0, x1, y1, c, r = 0) => {
    for (let y = Math.floor(y0 * S); y < y1 * S; y++) {
      for (let x = Math.floor(x0 * S); x < x1 * S; x++) {
        if (!r || inRoundRect(x, y, x0 * S, y0 * S, x1 * S, y1 * S, r * S)) set(x, y, ...c)
      }
    }
  }
  const circle = (cx, cy, rad, c) => {
    for (let y = Math.floor((cy - rad) * S); y < (cy + rad) * S; y++) {
      for (let x = Math.floor((cx - rad) * S); x < (cx + rad) * S; x++) {
        if ((x - cx * S) ** 2 + (y - cy * S) ** 2 <= (rad * S) ** 2) set(x, y, ...c)
      }
    }
  }

  const bg = [247, 244, 238]
  const green = [31, 92, 77]
  const green2 = [44, 111, 94]
  const gold = [217, 164, 65]
  const cream = [247, 244, 238]

  rect(0, 0, 512, 512, bg, 112)
  circle(382, 132, 44, gold)

  // 左右书页
  rect(120, 186, 256, 396, green, 22)
  rect(256, 186, 392, 396, green2, 22)
  // 书脊
  rect(248, 180, 264, 402, cream, 8)
  // 文字线
  for (let i = 0; i < 4; i++) {
    rect(158, 236 + i * 40, 224, 244 + i * 40, cream, 4)
    rect(288, 236 + i * 40, 354, 244 + i * 40, cream, 4)
  }
  return png(size, px)
}

fs.mkdirSync('public', { recursive: true })
fs.writeFileSync('public/icon-192.png', draw(192))
fs.writeFileSync('public/icon-512.png', draw(512))
console.log('icons generated')
