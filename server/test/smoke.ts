import WebSocket from 'ws'

const WS_URL = process.env.WS_URL || 'ws://localhost:3001'

function waitForMessage(ws: WebSocket, predicate: (data: any) => boolean, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('Timeout waiting for message')), timeoutMs)
    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(String(raw))
        if (predicate(data)) {
          clearTimeout(to)
          resolve(data)
        }
      } catch {}
    })
  })
}

async function run() {
  const a = new WebSocket(WS_URL)
  const b = new WebSocket(WS_URL)

  await Promise.all([
    waitForMessage(a, (m) => m.type === 'connected'),
    waitForMessage(b, (m) => m.type === 'connected'),
  ])

  a.send(JSON.stringify({ type: 'join', payload: { roomId: 'smoke', name: 'Alice' } }))
  b.send(JSON.stringify({ type: 'join', payload: { roomId: 'smoke', name: 'Bob' } }))

  await Promise.all([
    waitForMessage(a, (m) => m.type === 'joined'),
    waitForMessage(b, (m) => m.type === 'joined'),
  ])

  const chatPromise = waitForMessage(b, (m) => m.type === 'chat' && m.payload.text === 'Hello Bob')
  a.send(JSON.stringify({ type: 'chat', payload: { text: 'Hello Bob' } }))
  const chat = await chatPromise
  console.log('Received chat:', chat)

  a.close()
  b.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

