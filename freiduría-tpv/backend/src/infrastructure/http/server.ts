import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './app';
import { initSocketServer } from '../websocket/socket.server';

const PORT = process.env.PORT ?? 3001;
const app = createApp();
const httpServer = createServer(app);

initSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🍤 Freiduría TPV server → http://localhost:${PORT}`);
});
