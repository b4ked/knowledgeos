/**
 * Phase 1 — VPS Backend verification
 * Run with: VPS_URL=http://localhost:4000 VPS_API_TOKEN=knowledgeos-vps-token npx playwright test tests/e2e/phase1-backend.spec.ts
 */
import { test, expect } from '@playwright/test'

const VPS_URL = process.env.VPS_URL ?? 'http://localhost:4000'
const VPS_TOKEN = process.env.VPS_API_TOKEN ?? 'knowledgeos-vps-token'

function authHeaders() {
  return { Authorization: `Bearer ${VPS_TOKEN}` }
}

test.describe('Phase 1 — VPS Backend', () => {

  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get(`${VPS_URL}/health`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.vault).toBeTruthy()
  })

  test('unauthenticated request is rejected', async ({ request }) => {
    const res = await request.get(`${VPS_URL}/api/notes?folder=wiki`)
    expect(res.status()).toBe(401)
  })

  test('wrong token is rejected', async ({ request }) => {
    const res = await request.get(`${VPS_URL}/api/notes?folder=wiki`, {
      headers: { Authorization: 'Bearer wrong-token' },
    })
    expect(res.status()).toBe(401)
  })

  test('wiki notes list returns array', async ({ request }) => {
    const res = await request.get(`${VPS_URL}/api/notes?folder=wiki`, {
      headers: authHeaders(),
    })
    expect(res.ok()).toBeTruthy()
    const notes = await res.json()
    expect(Array.isArray(notes)).toBe(true)
    expect(notes.length).toBeGreaterThan(0)
  })

  test('raw notes list returns array', async ({ request }) => {
    const res = await request.get(`${VPS_URL}/api/notes?folder=raw`, {
      headers: authHeaders(),
    })
    expect(res.ok()).toBeTruthy()
    const notes = await res.json()
    expect(Array.isArray(notes)).toBe(true)
    expect(notes.length).toBeGreaterThan(0)
  })

  test('graph endpoint returns nodes and edges', async ({ request }) => {
    const res = await request.get(`${VPS_URL}/api/graph`, {
      headers: authHeaders(),
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data.nodes)).toBe(true)
    expect(Array.isArray(data.edges)).toBe(true)
    expect(data.nodes.length).toBeGreaterThan(0)
  })

  test('can read a specific wiki note', async ({ request }) => {
    const res = await request.get(`${VPS_URL}/api/notes/welcome?folder=wiki`, {
      headers: authHeaders(),
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(typeof data.content).toBe('string')
    expect(data.content.length).toBeGreaterThan(0)
  })

  test('conventions endpoint returns defaults', async ({ request }) => {
    const res = await request.get(`${VPS_URL}/api/conventions`, {
      headers: authHeaders(),
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.provider).toBeDefined()
  })

  test('settings endpoint returns object', async ({ request }) => {
    const res = await request.get(`${VPS_URL}/api/settings`, {
      headers: authHeaders(),
    })
    expect(res.ok()).toBeTruthy()
  })

  test('unknown folder returns 400', async ({ request }) => {
    const res = await request.get(`${VPS_URL}/api/notes?folder=invalid`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(400)
  })

  test('write and delete a raw note', async ({ request }) => {
    const slug = `test-${Date.now()}`
    // Create
    const createRes = await request.post(`${VPS_URL}/api/notes`, {
      headers: authHeaders(),
      data: { folder: 'raw', filename: slug, content: '# Test\n\nTemporary test note.' },
    })
    expect(createRes.status()).toBe(201)

    // Read back
    const readRes = await request.get(`${VPS_URL}/api/notes/${slug}?folder=raw`, {
      headers: authHeaders(),
    })
    expect(readRes.ok()).toBeTruthy()
    const { content } = await readRes.json()
    expect(content).toContain('Temporary test note')

    // Delete
    const deleteRes = await request.delete(`${VPS_URL}/api/notes/${slug}?folder=raw`, {
      headers: authHeaders(),
    })
    expect(deleteRes.status()).toBe(204)

    // Verify gone
    const gone = await request.get(`${VPS_URL}/api/notes/${slug}?folder=raw`, {
      headers: authHeaders(),
    })
    expect(gone.status()).toBe(404)
  })

})
