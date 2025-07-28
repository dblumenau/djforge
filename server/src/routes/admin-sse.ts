import { Router } from 'express';
import { sseConnectionManager } from '../services/sse-connection-manager';

const router = Router();

// Admin endpoint to view SSE connection status
router.get('/status', (req, res) => {
  res.json({
    totalConnections: sseConnectionManager.getConnectionCount(),
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