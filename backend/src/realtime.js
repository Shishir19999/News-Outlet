// Socket.IO hub for live blogs, breaking news and the alert banner. When no server is attached
// (tests, scripts) emitting is a no-op.
import { Server } from 'socket.io';

let io = null;
const ID = /^[a-f0-9]{24}$/;

export function attachRealtime(httpServer, { origin = '*' } = {}) {
  io = new Server(httpServer, { cors: { origin }, serveClient: false });
  io.on('connection', (socket) => {
    socket.on('live:join', (id) => { if (typeof id === 'string' && ID.test(id)) socket.join(`live:${id}`); });
    socket.on('live:leave', (id) => { if (typeof id === 'string') socket.leave(`live:${id}`); });
    socket.join('site');
  });
  return io;
}
export const emitLive = (newsId, payload) => { if (io) io.to(`live:${newsId}`).emit('live:update', { newsId: String(newsId), ...payload }); };
export const emitSite = (event, payload) => { if (io) io.to('site').emit(event, payload); };
export const closeRealtime = async () => { if (io) { await io.close(); io = null; } };
