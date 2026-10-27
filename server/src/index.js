import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { config, env } from './config.js';
import { registerSocketHandlers } from './rooms/socketHandlers.js';

const clientOrigin = env('CLIENT_ORIGIN', 'http://localhost:5173');

const app = express();
app.use(cors({ origin: clientOrigin }));
app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: clientOrigin } });

registerSocketHandlers(io);

server.listen(config.port, () => {
  console.log(`Midnight Manor server on http://localhost:${config.port} (client: ${clientOrigin})`);
});
