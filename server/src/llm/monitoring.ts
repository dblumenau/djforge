/**
 * Simple monitoring for LLM interpreter performance and patterns
 * This data can be used to optimize prompts and identify common use cases
 */

interface InterpretationMetrics {
  command: string;
  intent: string;
  confidence: number;
  model?: string;
  success: boolean;
  responseTime: number;
  timestamp: Date;
  error?: string;
}

class LLMMonitor {
  private metrics: InterpretationMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 for analysis
  
  recordInterpretation(
    command: string,
    interpretation: any,
    startTime: number,
    success: boolean,
    error?: string
  ) {
    const metric: InterpretationMetrics = {
      command: command.substring(0, 200), // Truncate for storage
      intent: interpretation?.intent || 'unknown',
      confidence: interpretation?.confidence || 0,
      model: interpretation?.model,
      success,
      responseTime: Date.now() - startTime,
      timestamp: new Date(),
      error: error?.substring(0, 200)
    };
    
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    // Log slow responses or failures
    if (metric.responseTime > 5000 || !success) {
      console.warn('LLM Performance Issue:', {
        command: metric.command,
        responseTime: metric.responseTime,
        success: metric.success,
        error: metric.error
      });
    }
  }
  
  getStats() {
    if (this.metrics.length === 0) {
      return { totalRequests: 0 };
    }
    
    const successfulMetrics = this.metrics.filter(m => m.success);
    const avgResponseTime = successfulMetrics.reduce((sum, m) => sum + m.responseTime, 0) / successfulMetrics.length;
    
    // Group by intent
    const intentCounts = this.metrics.reduce((acc, m) => {
      acc[m.intent] = (acc[m.intent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Find common patterns
    const commonCommands = this.findCommonPatterns();
    
    return {
      totalRequests: this.metrics.length,
      successRate: (successfulMetrics.length / this.metrics.length) * 100,
      avgResponseTime: Math.round(avgResponseTime),
      intentDistribution: intentCounts,
      commonPatterns: commonCommands,
      recentErrors: this.metrics
        .filter(m => !m.success && m.error)
        .slice(-5)
        .map(m => ({ command: m.command, error: m.error }))
    };
  }
  
  private findCommonPatterns(): Array<{ pattern: string; count: number }> {
    const patterns = new Map<string, number>();
    
    // Simple pattern extraction
    this.metrics.forEach(m => {
      const words = m.command.toLowerCase().split(/\s+/);
      
      // Look for 2-word phrases
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        patterns.set(phrase, (patterns.get(phrase) || 0) + 1);
      }
    });
    
    // Return top patterns
    return Array.from(patterns.entries())
      .filter(([_, count]) => count > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));
  }
  
  // Get metrics for specific time range
  getMetricsForTimeRange(startTime: Date, endTime: Date) {
    return this.metrics.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );
  }
  
  // Clear old metrics
  cleanup() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneDayAgo);
  }
}

// Singleton instance
export const llmMonitor = new LLMMonitor();

// Cleanup old metrics every hour
setInterval(() => {
  llmMonitor.cleanup();
}, 60 * 60 * 1000);