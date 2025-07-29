import { Router } from 'express';
import { requireValidTokens } from '../middleware/session-auth';
import { logger } from '../config/logger';

export const webPlayerRouter = Router();

// Store Web SDK device info in memory (could use Redis for multi-instance)
const webPlayerDevices = new Map<string, {
  deviceId: string;
  name: string;
  userId: string;
  lastSeen: Date;
}>();

// Register Web SDK device
webPlayerRouter.post('/register', requireValidTokens, async (req: any, res) => {
  try {
    const { deviceId, name = 'DJForge Web Player' } = req.body;
    const userId = req.sessionId || 'unknown';
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }
    
    webPlayerDevices.set(deviceId, {
      deviceId,
      name,
      userId,
      lastSeen: new Date()
    });
    
    logger.info('[WebPlayer] Registered Web SDK device', { deviceId, name, userId });
    
    res.json({ success: true, message: 'Web SDK device registered' });
  } catch (error: any) {
    logger.error('[WebPlayer] Error registering device:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get registered Web SDK devices
webPlayerRouter.get('/devices', requireValidTokens, async (req: any, res) => {
  try {
    const userId = req.sessionId || 'unknown';
    const userDevices = Array.from(webPlayerDevices.values())
      .filter(device => device.userId === userId)
      .map(device => ({
        id: device.deviceId,
        name: device.name,
        type: 'Web',
        is_active: false, // This will be determined by Spotify API
        volume_percent: 50, // Default
        lastSeen: device.lastSeen
      }));
    
    res.json({ devices: userDevices });
  } catch (error: any) {
    logger.error('[WebPlayer] Error getting devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cleanup old devices (called periodically)
setInterval(() => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  for (const [deviceId, device] of webPlayerDevices.entries()) {
    if (device.lastSeen < fiveMinutesAgo) {
      webPlayerDevices.delete(deviceId);
      logger.info('[WebPlayer] Removed stale device', { deviceId });
    }
  }
}, 60000); // Check every minute