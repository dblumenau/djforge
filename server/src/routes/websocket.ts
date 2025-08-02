import { Router } from 'express';
import { getWebSocketService } from '../services/websocket.service';

export const websocketRouter = Router();

// Health check for music WebSocket
websocketRouter.get('/health/music', (req, res) => {
  const wsService = getWebSocketService();
  const musicService = wsService?.getMusicService();
  
  if (!musicService) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'Music WebSocket service not initialized'
    });
  }
  
  res.json({
    status: 'healthy',
    connections: musicService.getConnectionCount(),
    subscriptions: musicService.getSubscriptionCount(),
    connectionsByUser: Object.fromEntries(musicService.getConnectionsByUser()),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// General WebSocket health check
websocketRouter.get('/health', (req, res) => {
  const wsService = getWebSocketService();
  
  if (!wsService) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'WebSocket service not initialized'
    });
  }
  
  const musicService = wsService.getMusicService();
  
  res.json({
    status: 'healthy',
    services: {
      demo: {
        connections: wsService.getConnectionCount(),
        connectionsByIP: Object.fromEntries(wsService.getConnectionsByIP())
      },
      music: musicService ? {
        connections: musicService.getConnectionCount(),
        subscriptions: musicService.getSubscriptionCount(),
        connectionsByUser: Object.fromEntries(musicService.getConnectionsByUser())
      } : {
        status: 'disabled',
        message: 'Music WebSocket service not available'
      }
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// WebSocket stats endpoint (for monitoring)
websocketRouter.get('/stats', (req, res) => {
  const wsService = getWebSocketService();
  const musicService = wsService?.getMusicService();
  
  const stats = {
    demo: wsService ? {
      totalConnections: wsService.getConnectionCount(),
      connectionsByIP: wsService.getConnectionsByIP().size,
      maxConnectionsPerIP: 10 // From config
    } : null,
    music: musicService ? {
      totalConnections: musicService.getConnectionCount(),
      activeUsers: musicService.getSubscriptionCount(),
      maxConnectionsPerUser: 5 // From config
    } : null,
    server: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      pid: process.pid
    },
    timestamp: new Date().toISOString()
  };
  
  res.json(stats);
});