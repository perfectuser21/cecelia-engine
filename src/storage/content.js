/**
 * Content Storage Module
 * Manages content persistence and version control
 */

import pg from 'pg';
const { Pool } = pg;
import { logger } from '../utils/logger.js';

class ContentStorage {
  constructor(config = {}) {
    this.pool = new Pool({
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || 5432,
      database: config.database || process.env.DB_NAME || 'content_pipeline',
      user: config.user || process.env.DB_USER || 'postgres',
      password: config.password || process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.initialized = false;
  }

  /**
   * Initialize database schema
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await this.createTables();
      this.initialized = true;
      logger.info('Content storage initialized');
    } catch (error) {
      logger.error('Failed to initialize content storage', { error: error.message });
      throw error;
    }
  }

  /**
   * Create required tables
   */
  async createTables() {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Content table
      await client.query(`
        CREATE TABLE IF NOT EXISTS content (
          id SERIAL PRIMARY KEY,
          content_id VARCHAR(100) UNIQUE NOT NULL,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(500),
          body TEXT,
          raw_content JSONB,
          metadata JSONB,
          quality_score DECIMAL(3,2),
          status VARCHAR(50) DEFAULT 'draft',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          published_at TIMESTAMP,
          version INTEGER DEFAULT 1
        )
      `);

      // Content versions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS content_versions (
          id SERIAL PRIMARY KEY,
          content_id VARCHAR(100) NOT NULL,
          version INTEGER NOT NULL,
          title VARCHAR(500),
          body TEXT,
          raw_content JSONB,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(100),
          change_description TEXT,
          UNIQUE(content_id, version)
        )
      `);

      // Content tags table
      await client.query(`
        CREATE TABLE IF NOT EXISTS content_tags (
          id SERIAL PRIMARY KEY,
          content_id VARCHAR(100) NOT NULL,
          tag VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(content_id, tag)
        )
      `);

      // Indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_content_type ON content(type)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_content_status ON content(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_content_created ON content(created_at DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_tags_content ON content_tags(content_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_tags_tag ON content_tags(tag)');

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save content to storage
   * @param {object} content - Content to save
   * @returns {Promise<string>} Content ID
   */
  async save(content) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const contentId = this.generateContentId();

      // Insert main content
      const query = `
        INSERT INTO content (
          content_id, type, title, body, raw_content,
          metadata, quality_score, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        contentId,
        content.type,
        content.title || this.extractTitle(content),
        content.body || JSON.stringify(content.content),
        content.content,
        content.metadata || {},
        content.quality?.score || null,
        content.status || 'draft',
      ];

      const result = await client.query(query, values);

      // Save initial version
      await this.saveVersion(client, contentId, 1, content, 'Initial version');

      // Save tags if present
      if (content.tags && Array.isArray(content.tags)) {
        await this.saveTags(client, contentId, content.tags);
      }

      await client.query('COMMIT');

      logger.info('Content saved', { contentId, type: content.type });
      return contentId;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to save content', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update existing content
   */
  async update(contentId, updates) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get current version
      const currentResult = await client.query(
        'SELECT version FROM content WHERE content_id = $1',
        [contentId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error(`Content not found: ${contentId}`);
      }

      const currentVersion = currentResult.rows[0].version;
      const newVersion = currentVersion + 1;

      // Update main content
      const updateQuery = `
        UPDATE content SET
          title = COALESCE($2, title),
          body = COALESCE($3, body),
          raw_content = COALESCE($4, raw_content),
          metadata = COALESCE($5, metadata),
          quality_score = COALESCE($6, quality_score),
          status = COALESCE($7, status),
          updated_at = CURRENT_TIMESTAMP,
          version = $8
        WHERE content_id = $1
        RETURNING *
      `;

      const values = [
        contentId,
        updates.title,
        updates.body,
        updates.content,
        updates.metadata,
        updates.quality?.score,
        updates.status,
        newVersion,
      ];

      const result = await client.query(updateQuery, values);

      // Save new version
      await this.saveVersion(
        client,
        contentId,
        newVersion,
        result.rows[0],
        updates.changeDescription || 'Content updated'
      );

      // Update tags if provided
      if (updates.tags) {
        await client.query('DELETE FROM content_tags WHERE content_id = $1', [contentId]);
        await this.saveTags(client, contentId, updates.tags);
      }

      await client.query('COMMIT');

      logger.info('Content updated', { contentId, version: newVersion });
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update content', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve content by ID
   */
  async get(contentId, version = null) {
    try {
      let query;
      let values;

      if (version) {
        query = `
          SELECT * FROM content_versions
          WHERE content_id = $1 AND version = $2
        `;
        values = [contentId, version];
      } else {
        query = 'SELECT * FROM content WHERE content_id = $1';
        values = [contentId];
      }

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const content = result.rows[0];

      // Get tags
      const tagsResult = await this.pool.query(
        'SELECT tag FROM content_tags WHERE content_id = $1',
        [contentId]
      );

      content.tags = tagsResult.rows.map(r => r.tag);

      return content;
    } catch (error) {
      logger.error('Failed to retrieve content', { error: error.message });
      throw error;
    }
  }

  /**
   * List content with filters
   */
  async list(filters = {}) {
    try {
      let query = 'SELECT * FROM content WHERE 1=1';
      const values = [];
      let paramCount = 0;

      // Build dynamic query
      if (filters.type) {
        paramCount++;
        query += ` AND type = $${paramCount}`;
        values.push(filters.type);
      }

      if (filters.status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        values.push(filters.status);
      }

      if (filters.minQuality) {
        paramCount++;
        query += ` AND quality_score >= $${paramCount}`;
        values.push(filters.minQuality);
      }

      if (filters.tag) {
        paramCount++;
        query += ` AND content_id IN (
          SELECT content_id FROM content_tags WHERE tag = $${paramCount}
        )`;
        values.push(filters.tag);
      }

      if (filters.startDate) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        values.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        values.push(filters.endDate);
      }

      // Add sorting
      const sortField = filters.sortBy || 'created_at';
      const sortOrder = filters.sortOrder || 'DESC';
      query += ` ORDER BY ${sortField} ${sortOrder}`;

      // Add pagination
      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        values.push(filters.offset);
      }

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('Failed to list content', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete content
   */
  async delete(contentId) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Delete tags
      await client.query('DELETE FROM content_tags WHERE content_id = $1', [contentId]);

      // Delete versions
      await client.query('DELETE FROM content_versions WHERE content_id = $1', [contentId]);

      // Delete main content
      const result = await client.query(
        'DELETE FROM content WHERE content_id = $1 RETURNING *',
        [contentId]
      );

      await client.query('COMMIT');

      logger.info('Content deleted', { contentId });
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete content', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get version history
   */
  async getVersionHistory(contentId) {
    try {
      const query = `
        SELECT version, created_at, created_by, change_description
        FROM content_versions
        WHERE content_id = $1
        ORDER BY version DESC
      `;

      const result = await this.pool.query(query, [contentId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get version history', { error: error.message });
      throw error;
    }
  }

  // Helper methods
  async saveVersion(client, contentId, version, content, description) {
    const query = `
      INSERT INTO content_versions (
        content_id, version, title, body, raw_content,
        metadata, created_by, change_description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const values = [
      contentId,
      version,
      content.title,
      content.body,
      content.raw_content || content.content,
      content.metadata,
      'system',
      description,
    ];

    await client.query(query, values);
  }

  async saveTags(client, contentId, tags) {
    for (const tag of tags) {
      await client.query(
        'INSERT INTO content_tags (content_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [contentId, tag]
      );
    }
  }

  generateContentId() {
    return `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  extractTitle(content) {
    if (content.title) return content.title;
    if (content.content?.title) return content.content.title;
    if (typeof content.body === 'string') {
      return content.body.substring(0, 100);
    }
    return 'Untitled';
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
    logger.info('Content storage connection closed');
  }
}

export { ContentStorage };