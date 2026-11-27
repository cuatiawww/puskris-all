import https from 'node:https'

const INSECURE_HOSTS = new Set(['pusatkrisis.kemkes.go.id'])

function shouldUseInsecureHttps(urlStr: string): boolean {
  if (process.env.PUSKRIS_INSECURE !== 'true' && process.env.PUSKRIS_EOC_INSECURE !== 'true') {
    return false
  }
  try {
    const u = new URL(urlStr)
    return u.protocol === 'https:' && INSECURE_HOSTS.has(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

export type PuskrisFetchOptions = {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

function httpsRequestText(urlStr: string, opts: PuskrisFetchOptions, redirectsLeft = 3): Promise<{ status: number; text: string }> {
  const method = opts.method || 'GET'
  const timeoutMs = opts.timeoutMs ?? 60_000
  const bodyBuf = opts.body !== undefined ? Buffer.from(opts.body, 'utf8') : null
  const headers: Record<string, string> = { ...(opts.headers || {}) }
  if (bodyBuf && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-length')) {
    headers['Content-Length'] = String(bodyBuf.byteLength)
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      urlStr,
      {
        method,
        headers,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode || 0
        const loc = res.headers.location
        if (loc && [301, 302, 303, 307, 308].includes(status) && redirectsLeft > 0) {
          res.resume()
          const nextUrl = new URL(loc, urlStr).toString()
          const nextMethod = status === 303 ? 'GET' : method
          const nextBody = status === 303 ? undefined : opts.body
          httpsRequestText(nextUrl, { ...opts, method: nextMethod, body: nextBody }, redirectsLeft - 1).then(resolve, reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        res.on('end', () => resolve({ status, text: Buffer.concat(chunks).toString('utf8') }))
        res.on('error', (err) => reject(err))
      },
    )
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Batas waktu habis'))
    })
    req.on('error', (err) => reject(err))
    if (bodyBuf) req.write(bodyBuf)
    req.end()
  })
}

function formatFetchError(e: any): Error {
  if (e?.name === 'AbortError' || e?.message === 'Batas waktu habis') {
    return new Error('Batas waktu habis')
  }
  const cause = e?.cause?.code || e?.cause?.message
  const msg = String(e?.message || e)
  return new Error(cause && !msg.includes(String(cause)) ? `${msg} (${cause})` : msg)
}

/**
 * Fetch JSON khusus server-side Puskris.
 * Saat berjalan di dalam host produksi pusatkrisis.kemkes.go.id (PUSKRIS_EOC_INSECURE=true),
 * permintaan ke host internal pusatkrisis.kemkes.go.id memakai node:https dengan rejectUnauthorized:false
 * agar tidak gagal sertifikat origin/hairpin TLS. Host lain tetap memakai fetch() standar (TLS penuh).
 */
export async function puskrisFetchJson(url: string, opts: PuskrisFetchOptions = {}): Promise<any> {
  const method = opts.method || 'GET'
  const timeoutMs = opts.timeoutMs ?? 60_000
  const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers || {}) }

  if (shouldUseInsecureHttps(url)) {
    try {
      const { status, text } = await httpsRequestText(url, { method, headers, body: opts.body, timeoutMs })
      if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`)
      return JSON.parse(text)
    } catch (e: any) {
      throw formatFetchError(e)
    }
  }

  const ctl = new AbortController()
  const tm = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(url, {
      method,
      headers,
      body: opts.body,
      cache: 'no-store',
      signal: ctl.signal,
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.json()
  } catch (e: any) {
    throw formatFetchError(e)
  } finally {
    clearTimeout(tm)
  }
}
