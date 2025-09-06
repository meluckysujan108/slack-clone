import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

type ChatMessage = { from: { id: string; name: string }; text: string }
type Member = { id: string; name: string }

const WS_URL = (import.meta.env.VITE_WS_URL as string) || (location.origin.replace(/^http/, 'ws'))

export default function App() {
  const [clientId, setClientId] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [roomId, setRoomId] = useState<string>('demo')
  const [connectedRoom, setConnectedRoom] = useState<string>('')
  const [members, setMembers] = useState<Member[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState<string>('')

  const wsRef = useRef<WebSocket | null>(null)

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  const connectWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(WS_URL.replace(/^http/, 'ws'))
    wsRef.current = ws
    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'connected') {
        setClientId(msg.payload.clientId)
        if (!name) setName(msg.payload.name)
      }
      if (msg.type === 'joined') {
        setConnectedRoom(msg.payload.roomId)
        setMembers(msg.payload.members)
      }
      if (msg.type === 'presence') {
        if (msg.payload.event === 'join') {
          setMembers((m) => {
            const exists = m.some((x) => x.id === msg.payload.member.id)
            return exists ? m : [...m, msg.payload.member]
          })
        } else if (msg.payload.event === 'leave') {
          setMembers((m) => m.filter((x) => x.id !== msg.payload.member.id))
        }
      }
      if (msg.type === 'chat') {
        setMessages((prev) => [...prev, msg.payload])
      }
      if (msg.type === 'signal') {
        await handleSignal(msg.payload.fromId, msg.payload.data)
      }
    }
    ws.onclose = () => {
      setConnectedRoom('')
      setMembers([])
    }
  }, [name])

  useEffect(() => {
    connectWs()
  }, [connectWs])

  const join = useCallback(() => {
    wsRef.current?.send(
      JSON.stringify({ type: 'join', payload: { roomId, name } }),
    )
  }, [roomId, name])

  const leave = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'leave' }))
    setConnectedRoom('')
    stopCall()
  }, [])

  const sendChat = useCallback(() => {
    if (!input) return
    wsRef.current?.send(JSON.stringify({ type: 'chat', payload: { text: input } }))
    setInput('')
  }, [input])

  const ensurePeer = useCallback(() => {
    if (peerRef.current) return peerRef.current
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    })
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        wsRef.current?.send(
          JSON.stringify({ type: 'signal', payload: { targetId: currentPeerIdRef.current, data: { candidate: e.candidate } } }),
        )
      }
    }
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0]
      }
    }
    peerRef.current = pc
    return pc
  }, [])

  const currentPeerIdRef = useRef<string>('')

  const startCall = useCallback(async (targetId: string) => {
    currentPeerIdRef.current = targetId
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    localStreamRef.current = stream
    if (localVideoRef.current) localVideoRef.current.srcObject = stream
    const pc = ensurePeer()
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    wsRef.current?.send(JSON.stringify({ type: 'signal', payload: { targetId, data: { sdp: pc.localDescription } } }))
  }, [ensurePeer])

  const handleSignal = useCallback(async (fromId: string, data: any) => {
    const pc = ensurePeer()
    if (data?.sdp) {
      const desc = new RTCSessionDescription(data.sdp)
      if (desc.type === 'offer') {
        currentPeerIdRef.current = fromId
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        stream.getTracks().forEach((t) => pc.addTrack(t, stream))
        await pc.setRemoteDescription(desc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        wsRef.current?.send(JSON.stringify({ type: 'signal', payload: { targetId: fromId, data: { sdp: pc.localDescription } } }))
      } else if (desc.type === 'answer') {
        await pc.setRemoteDescription(desc)
      }
    } else if (data?.candidate) {
      try {
        await pc.addIceCandidate(data.candidate)
      } catch (e) {
        console.error('ICE error', e)
      }
    }
  }, [ensurePeer])

  const stopCall = useCallback(() => {
    currentPeerIdRef.current = ''
    peerRef.current?.getSenders().forEach((s) => s.track?.stop())
    peerRef.current?.close()
    peerRef.current = null
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      (localVideoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop())
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    localStreamRef.current = null
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: '100vh' }}>
      <div style={{ borderRight: '1px solid #eee', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Slack-lite</div>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          Room
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} style={{ width: '100%' }} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {connectedRoom ? (
            <button onClick={leave}>Leave</button>
          ) : (
            <button onClick={join}>Join</button>
          )}
        </div>
        <div style={{ marginTop: 12, fontWeight: 600 }}>Members</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{m.name}{m.id === clientId ? ' (you)' : ''}</span>
              {m.id !== clientId && (
                <button onClick={() => startCall(m.id)}>Call</button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateRows: '1fr auto', height: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12 }}>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', background: '#000', borderRadius: 8 }} />
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', background: '#000', borderRadius: 8 }} />
        </div>
        <div style={{ padding: 12, borderTop: '1px solid #eee' }}>
          <div style={{ height: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {messages.map((m, i) => (
              <div key={i}><b>{m.from.name}:</b> {m.text}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') sendChat() }} />
            <button onClick={sendChat}>Send</button>
            <button onClick={stopCall}>Hang up</button>
          </div>
        </div>
      </div>
    </div>
  )
}

