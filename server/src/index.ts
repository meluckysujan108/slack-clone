import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { z } from "zod";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

type Client = {
  id: string;
  socket: WebSocket;
  roomId: string | null;
  name: string;
};

type Room = {
  id: string;
  members: Map<string, Client>;
};

const clients = new Map<string, Client>();
const rooms = new Map<string, Room>();

const wss = new WebSocketServer({ noServer: true });

const MessageSchema = z.object({
  type: z.string(),
  payload: z.any().optional(),
});

function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = { id: roomId, members: new Map() };
    rooms.set(roomId, room);
  }
  return room;
}

function broadcastToRoom(roomId: string, data: unknown, exceptClientId?: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const encoded = JSON.stringify(data);
  for (const [memberId, member] of room.members) {
    if (exceptClientId && memberId === exceptClientId) continue;
    if (member.socket.readyState === WebSocket.OPEN) {
      member.socket.send(encoded);
    }
  }
}

wss.on("connection", (ws) => {
  const clientId = randomUUID();
  const client: Client = { id: clientId, socket: ws, roomId: null, name: `User-${clientId.slice(0, 6)}` };
  clients.set(clientId, client);

  ws.send(JSON.stringify({ type: "connected", payload: { clientId, name: client.name } }));

  ws.on("message", (data) => {
    let msg: z.infer<typeof MessageSchema>;
    try {
      msg = MessageSchema.parse(JSON.parse(String(data)));
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid message" } }));
      return;
    }

    if (msg.type === "join") {
      const { roomId, name } = (msg.payload || {}) as { roomId?: string; name?: string };
      if (!roomId) return;
      if (name) client.name = name;
      const room = getOrCreateRoom(roomId);
      client.roomId = roomId;
      room.members.set(client.id, client);
      ws.send(JSON.stringify({ type: "joined", payload: { roomId, members: [...room.members.values()].map(m => ({ id: m.id, name: m.name })) } }));
      broadcastToRoom(roomId, { type: "presence", payload: { event: "join", member: { id: client.id, name: client.name } } }, client.id);
      return;
    }

    if (msg.type === "leave") {
      const roomId = client.roomId;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (room) {
        room.members.delete(client.id);
        broadcastToRoom(roomId, { type: "presence", payload: { event: "leave", member: { id: client.id, name: client.name } } }, client.id);
        if (room.members.size === 0) rooms.delete(roomId);
      }
      client.roomId = null;
      ws.send(JSON.stringify({ type: "left", payload: { roomId } }));
      return;
    }

    if (msg.type === "chat") {
      if (!client.roomId) return;
      broadcastToRoom(client.roomId, { type: "chat", payload: { from: { id: client.id, name: client.name }, text: (msg.payload as any)?.text } });
      return;
    }

    if (msg.type === "signal") {
      const { targetId, data: signalData } = (msg.payload || {}) as { targetId?: string; data?: unknown };
      if (!targetId) return;
      const targetClient = clients.get(targetId);
      if (targetClient && targetClient.socket.readyState === WebSocket.OPEN) {
        targetClient.socket.send(JSON.stringify({ type: "signal", payload: { fromId: client.id, data: signalData } }));
      }
      return;
    }
  });

  ws.on("close", () => {
    const roomId = client.roomId;
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.members.delete(client.id);
        broadcastToRoom(roomId, { type: "presence", payload: { event: "leave", member: { id: client.id, name: client.name } } }, client.id);
        if (room.members.size === 0) rooms.delete(roomId);
      }
    }
    clients.delete(client.id);
  });
});

const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

