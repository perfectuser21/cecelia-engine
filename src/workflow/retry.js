/**
 * Retry Mechanism Module
 * Implements exponential backoff retry logic for failed tasks
 */

const { logger } = require('../utils/logger');

class RetryManager {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries || 3;
    this.initialDelay = config.initialDelay || 1000;
    this.maxDelay = config.maxDelay || 30000;
    this.backoffMultiplier = config.backoffMultiplier || 2;
    this.jitter = config.jitter !== false;
    this.retryableErrors = config.retryableErrors || [
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'RATE_LIMIT',
    ];
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Function to execute
   * @param {object} options - Retry options
   * @returns {Promise} Result of successful execution
   */
  async executeWithRetry(fn, options = {}) {
    const maxAttempts = options.maxRetries || this.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.debug(`Attempt ${attempt}/${maxAttempts}`, { operation: options.name });

        const result = await this.attempt(fn, attempt, options);

        if (attempt > 1) {
          logger.info('Operation succeeded after retry', {
            operation: options.name,
            attempt,
          });
        }

        return result;
      } catch (error) {
        lastError = error;

        if (!this.shouldRetry(error, attempt, maxAttempts)) {
          logger.error('Operation failed, not retryable', {
            operation: options.name,
            attempt,
            error: error.message,
          });
          throw error;
        }

        const delay = this.calculateDelay(attempt);

        logger.warn('Operation failed, will retry', {
          operation: options.name,
          attempt,
          nextAttempt: attempt + 1,
          delay,
          error: error.message,
        });

        await this.delay(delay);

        if (options.onRetry) {
          await options.onRetry(error, attempt);
        }
      }
    }

    logger.error('Operation failed after all retries', {
      operation: options.name,
      attempts: maxAttempts,
      error: lastError.message,
    });

    throw new Error(`Failed after ${maxAttempts} attempts: ${lastError.message}`);
  }

  /**
   * Execute single attempt
   */
  async attempt(fn, attemptNumber, options) {
    const timeout = options.timeout || 30000;

    if (timeout) {
      return this.withTimeout(fn(), timeout, options.name);
    }

    return fn();
  }

  /**
   * Add timeout to promise
   */
  async withTimeout(promise, timeout, operationName) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeout}ms: ${operationName}`));
        }, timeout);
      }),
    ]);
  }

  /**
   * Determine if error is retryable
   */
  shouldRetry(error, attempt, maxAttempts) {
    // Don't retry if we've exhausted attempts
    if (attempt >= maxAttempts) return false;

    // Check if error is in retryable list
    const errorCode = error.code || error.type || error.name;
    if (this.retryableErrors.includes(errorCode)) return true;

    // Check for specific error messages
    const message = error.message || '';
    if (message.includes('rate limit')) return true;
    if (message.includes('timeout')) return true;
    if (message.includes('temporary')) return true;
    if (message.includes('unavailable')) return true;

    // Check HTTP status codes if present
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      // Retry on 5xx errors and specific 4xx errors
      if (status >= 500 || status === 429 || status === 408) return true;
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff
   */
  calculateDelay(attempt) {
    let delay = this.initialDelay * Math.pow(this.backoffMultiplier, attempt - 1);

    // Apply maximum delay cap
    delay = Math.min(delay, this.maxDelay);

    // Add jitter to prevent thundering herd
    if (this.jitter) {
      const jitterAmount = delay * 0.1 * Math.random();
      delay = delay + jitterAmount;
    }

    return Math.round(delay);
  }

  /**
   * Delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create retry wrapper for a function
   */
  createRetryWrapper(fn, defaultOptions = {}) {
    return async (...args) => {
      return this.executeWithRetry(
        () => fn(...args),
        defaultOptions
      );
    };
  }

  /**
   * Batch retry for multiple operations
   */
  async batchRetry(operations, options = {}) {
    const results = [];
    const errors = [];

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];

      try {
        const result = await this.executeWithRetry(
          operation.fn,
          {
            ...options,
            name: operation.name || `Operation ${i + 1}`,
            onRetry: operation.onRetry,
          }
        );

        results.push({
          index: i,
          name: operation.name,
          status: 'success',
          result,
        });
      } catch (error) {
        errors.push({
          index: i,
          name: operation.name,
          status: 'failed',
          error: error.message,
        });

        if (!options.continueOnError) {
          throw error;
        }
      }
    }

    return {
      successful: results,
      failed: errors,
      totalOperations: operations.length,
      successCount: results.length,
      failureCount: errors.length,
      successRate: (results.length / operations.length) * 100,
    };
  }

  /**
   * Circuit breaker pattern implementation
   */
  createCircuitBreaker(fn, options = {}) {
    const state = {
      failures: 0,
      lastFailureTime: null,
      isOpen: false,
    };

    const threshold = options.failureThreshold || 5;
    const resetTimeout = options.resetTimeout || 60000;

    return async (...args) => {
      // Check if circuit should be reset
      if (state.isOpen && state.lastFailureTime) {
        const timeSinceFailure = Date.now() - state.lastFailureTime;
        if (timeSinceFailure > resetTimeout) {
          state.isOpen = false;
          state.failures = 0;
          logger.info('Circuit breaker reset');
        }
      }

      // If circuit is open, fail fast
      if (state.isOpen) {
        throw new Error('Circuit breaker is open - service unavailable');
      }

      try {
        const result = await this.executeWithRetry(
          () => fn(...args),
          options
        );

        // Reset failure count on success
        if (state.failures > 0) {
          state.failures = 0;
          logger.info('Circuit breaker failures reset after success');
        }

        return result;
      } catch (error) {
        state.failures++;
        state.lastFailureTime = Date.now();

        if (state.failures >= threshold) {
          state.isOpen = true;
          logger.error('Circuit breaker opened', {
            failures: state.failures,
            threshold,
          });
        }

        throw error;
      }
    };
  }

  /**
   * Progressive retry with increasing timeout
   */
  async progressiveRetry(fn, options = {}) {
    const stages = options.stages || [
      { retries: 2, delay: 1000 },
      { retries: 2, delay: 5000 },
      { retries: 1, delay: 10000 },
    ];

    let lastError;

    for (const stage of stages) {
      try {
        return await this.executeWithRetry(fn, {
          ...options,
          maxRetries: stage.retries,
          initialDelay: stage.delay,
        });
      } catch (error) {
        lastError = error;
        logger.warn('Progressive retry stage failed', {
          retries: stage.retries,
          delay: stage.delay,
        });
      }
    }

    throw lastError;
  }
}

module.exports = { RetryManager };