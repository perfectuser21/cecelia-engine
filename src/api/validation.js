/**
 * Request Validation Module
 * Validates API requests
 */

const { logger } = require('../utils/logger');

const schemas = {
  generate: {
    type: {
      required: true,
      enum: ['article', 'social', 'video_script'],
    },
    params: {
      required: true,
      type: 'object',
      properties: {
        topic: { required: true, type: 'string' },
        length: { type: 'number' },
        style: { type: 'string' },
        audience: { type: 'string' },
      },
    },
  },

  batch: {
    jobs: {
      required: true,
      type: 'array',
      minLength: 1,
      maxLength: 100,
      items: {
        type: { required: true },
        params: { required: true, type: 'object' },
      },
    },
  },

  schedule: {
    type: {
      required: true,
      enum: ['article', 'social', 'video_script'],
    },
    params: {
      required: true,
      type: 'object',
    },
    priority: {
      type: 'number',
      min: 0,
      max: 10,
    },
  },

  evaluate: {
    content: {
      required: true,
      type: 'object',
    },
    type: {
      required: true,
      enum: ['article', 'social', 'video_script'],
    },
  },

  update: {
    title: { type: 'string' },
    body: { type: 'string' },
    status: {
      enum: ['draft', 'review', 'approved', 'published'],
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

/**
 * Validate request middleware factory
 */
function validateRequest(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      logger.error('Schema not found', { schemaName });
      return res.status(500).json({
        success: false,
        error: 'Internal validation error',
      });
    }

    const errors = validateObject(req.body, schema);

    if (errors.length > 0) {
      logger.warn('Validation failed', { schemaName, errors });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors,
      });
    }

    next();
  };
}

/**
 * Validate object against schema
 */
function validateObject(obj, schema, path = '') {
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const fullPath = path ? `${path}.${key}` : key;
    const value = obj[key];

    // Check required
    if (rules.required && (value === undefined || value === null)) {
      errors.push({
        field: fullPath,
        error: 'Field is required',
      });
      continue;
    }

    // Skip validation if not required and not present
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }

    // Type validation
    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push({
          field: fullPath,
          error: `Expected ${rules.type}, got ${actualType}`,
        });
        continue;
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({
        field: fullPath,
        error: `Value must be one of: ${rules.enum.join(', ')}`,
      });
    }

    // String validation
    if (rules.type === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({
          field: fullPath,
          error: `Minimum length is ${rules.minLength}`,
        });
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({
          field: fullPath,
          error: `Maximum length is ${rules.maxLength}`,
        });
      }
      if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
        errors.push({
          field: fullPath,
          error: 'Invalid format',
        });
      }
    }

    // Number validation
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({
          field: fullPath,
          error: `Minimum value is ${rules.min}`,
        });
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({
          field: fullPath,
          error: `Maximum value is ${rules.max}`,
        });
      }
    }

    // Array validation
    if (rules.type === 'array') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({
          field: fullPath,
          error: `Minimum ${rules.minLength} items required`,
        });
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({
          field: fullPath,
          error: `Maximum ${rules.maxLength} items allowed`,
        });
      }
      if (rules.items) {
        value.forEach((item, index) => {
          const itemErrors = validateObject(
            { item },
            { item: rules.items },
            `${fullPath}[${index}]`
          );
          errors.push(...itemErrors);
        });
      }
    }

    // Object validation
    if (rules.type === 'object' && rules.properties) {
      const objectErrors = validateObject(value, rules.properties, fullPath);
      errors.push(...objectErrors);
    }
  }

  return errors;
}

/**
 * Validate content type
 */
function validateContentType(type) {
  const validTypes = ['article', 'social', 'video_script'];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid content type: ${type}. Must be one of: ${validTypes.join(', ')}`);
  }
}

/**
 * Sanitize content
 */
function sanitizeContent(content) {
  if (typeof content === 'string') {
    // Remove potential XSS vectors
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  if (typeof content === 'object' && content !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(content)) {
      sanitized[key] = sanitizeContent(value);
    }
    return sanitized;
  }

  return content;
}

module.exports = {
  validateRequest,
  validateContentType,
  sanitizeContent,
};