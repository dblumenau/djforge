import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Validation schema for email
const emailSchema = z.object({
  email: z.string().email('Invalid email address').max(100, 'Email too long')
});

// Simple in-memory storage for demo purposes
// In production, you'd want to use a database
let waitlistEmails: Array<{ email: string; timestamp: Date }> = [];

// POST /api/waitlist - Add email to waitlist
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { email } = emailSchema.parse(req.body);
    
    // Check if email already exists
    const existingEmail = waitlistEmails.find(entry => entry.email === email);
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered for waitlist'
      });
    }
    
    // Add email to waitlist
    waitlistEmails.push({
      email,
      timestamp: new Date()
    });
    
    console.log(`📧 New waitlist signup: ${email}`);
    
    res.json({
      success: true,
      message: 'Successfully added to waitlist',
      email
    });
    
  } catch (error) {
    console.error('Waitlist signup error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/waitlist - Get waitlist count (for admin purposes)
router.get('/', (req, res) => {
  res.json({
    count: waitlistEmails.length,
    latest: waitlistEmails.slice(-5).map(entry => ({
      email: entry.email,
      timestamp: entry.timestamp
    }))
  });
});

export { router as waitlistRouter };