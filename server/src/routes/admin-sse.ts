import { Router } from 'express';
import { sseConnectionManager } from '../services/sse-connection-manager';

const router = Router();

// Admin endpoint to view SSE connection status
router.get('/status', (req, res) => {
  const connections = (sseConnectionManager as any).connections;
  const userCounts = (sseConnectionManager as any).userConnectionCount;
  
  // Get detailed connection info
  const connectionDetails: any[] = [];
  for (const [id, info] of connections.entries()) {
    connectionDetails.push({
      id,
      userId: info.userId,
      connectedAt: new Date(info.connectedAt).toISOString(),
      lastActivity: new Date(info.lastActivity).toISOString(),
      ageSeconds: Math.round((Date.now() - info.connectedAt) / 1000),
      lastActivitySeconds: Math.round((Date.now() - info.lastActivity) / 1000),
      isAlive: (sseConnectionManager as any).isConnectionAlive(info.res)
    });
  }
  
  res.json({
    totalConnections: sseConnectionManager.getConnectionCount(),
    userConnectionCounts: Object.fromEntries(userCounts),
    connections: connectionDetails,
    message: 'Use DELETE /api/admin/sse/connections to clear all connections'
  });
});

// Admin endpoint to force-clear all SSE connections
router.delete('/connections', (req, res) => {
  const count = sseConnectionManager.getConnectionCount();
  sseConnectionManager.clearAllConnections();
  
  res.json({
    success: true,
    message: `Cleared ${count} SSE connections`,
    previousCount: count,
    currentCount: sseConnectionManager.getConnectionCount()
  });
});

export default router;