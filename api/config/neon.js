const { Pool } = require('pg');

class NeonDatabase {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      if (this.isConnected && this.pool) {
        return this.pool;
      }

      const neonUrl = process.env.NEON_DATABASE_URL;
      
      if (!neonUrl) {
        throw new Error('NEON_DATABASE_URL environment variable not set');
      }

      // Create connection pool
      this.pool = new Pool({
        connectionString: neonUrl,
        ssl: {
          rejectUnauthorized: false
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log('Neon PostgreSQL Connected');

      // Connection event listeners
      this.pool.on('connect', () => {
        console.log('Client connected to Neon PostgreSQL');
      });

      this.pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        this.isConnected = false;
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
      });

      return this.pool;

    } catch (error) {
      console.error('Neon database connection error:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.pool) {
        await this.pool.end();
        this.isConnected = false;
        console.log('Neon PostgreSQL connection closed');
      }
    } catch (error) {
      console.error('Error closing Neon database connection:', error);
      throw error;
    }
  }

  async query(text, params) {
    try {
      if (!this.isConnected || !this.pool) {
        await this.connect();
      }

      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Neon database query error:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', message: 'Neon database not connected' };
      }

      const result = await this.query('SELECT NOW(), version()');
      
      return {
        status: 'healthy',
        message: 'Neon database connection is healthy',
        timestamp: result.rows[0].now,
        version: result.rows[0].version
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Neon database health check failed',
        error: error.message
      };
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      totalCount: this.pool?.totalCount || 0,
      idleCount: this.pool?.idleCount || 0,
      waitingCount: this.pool?.waitingCount || 0
    };
  }
}

// Export singleton instance
module.exports = new NeonDatabase();