const BASE = import.meta.env.VITE_API_BASE || '/api'

let accessToken = localStorage.getItem('schemeai_token') || ''

export function setToken(token) {
  accessToken = token || ''
  if (token) localStorage.setItem('schemeai_token', token)
  else localStorage.removeItem('schemeai_token')
}

export function getToken() {
  return accessToken
}

function detailMessage(data) {
  if (data && typeof data === 'object') {
    if (typeof data.detail === 'string') return data.detail
    if (Array.isArray(data.detail) && data.detail.length) {
      return data.detail.map((d) => d.msg).join('; ')
    }
    if (typeof data.error === 'string') return data.error
    if (typeof data.message === 'string') return data.message
  }
  return 'Request failed'
}

async function request(method, path, { body, formData, isBlob } = {}) {
  const headers = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const opts = { method, headers }
  if (formData) {
    opts.body = formData
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(`${BASE}${path}`, opts)

  if (isBlob) {
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(detailMessage(data))
    }
    return res.blob()
  }

  const ct = res.headers.get('content-type') || ''
  const isJson = ct.includes('application/json')
  const data = res.status === 204 ? null : isJson ? await res.json() : await res.arrayBuffer()

  if (!res.ok) {
    const err = new Error(detailMessage(data))
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  request: (action, payload) => {
    const methods = ['login', 'register']
    if (methods.includes(action)) {
      return request('POST', `/auth/${action}`, { body: payload })
    }
    return request('GET', `/${action}`, { body: payload })
  },

  get: (path) => request('GET', path),

  post: (path, body) => request('POST', path, { body }),

  put: (path, body) => request('PUT', path, { body }),

  del: (path) => request('DELETE', path),

  upload: (path, formData) => request('POST', path, { formData }),

  download: (path) => request('GET', path, { isBlob: true }),
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtRupees(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return v
  return '₹' + n.toLocaleString('en-IN')
}
