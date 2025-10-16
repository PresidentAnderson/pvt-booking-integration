const mongoose = require('mongoose');
const neonDB = require('./neon');

class Database {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.neonEnabled = !!process.env.NEON_DATABASE_URL;
  }

  async connect() {
    try {
      // Prevent multiple connections
      if (this.isConnected) {
        return this.connection;
      }

      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pvt-booking';
      
      const options = {
        // Connection options
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        
        // Stability options
        bufferCommands: false,
        bufferMaxEntries: 0,
        
        // Naming strategy
        useNewUrlParser: true,
        useUnifiedTopology: true
      };

      // Connect to MongoDB
      this.connection = await mongoose.connect(mongoUri, options);
      this.isConnected = true;

      console.log(`MongoDB Connected: ${this.connection.connection.host}`);

      // Connection event listeners
      mongoose.connection.on('connected', () => {
        console.log('Mongoose connected to MongoDB');
        this.isConnected = true;
      });

      mongoose.connection.on('error', (err) => {
        console.error('Mongoose connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('Mongoose disconnected from MongoDB');
        this.isConnected = false;
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

      return this.connection;

    } catch (error) {
      console.error('Database connection error:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.isConnected) {
        await mongoose.connection.close();
        this.isConnected = false;
        console.log('MongoDB connection closed');
      }
    } catch (error) {
      console.error('Error closing database connection:', error);
      throw error;
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }

  async healthCheck() {
    try {
      const results = {};
      
      // MongoDB Health Check
      if (!this.isConnected) {
        results.mongodb = { status: 'disconnected', message: 'MongoDB not connected' };
      } else {
        try {
          await mongoose.connection.db.admin().ping();
          results.mongodb = {
            status: 'healthy',
            message: 'MongoDB connection is healthy',
            details: this.getConnectionStatus()
          };
        } catch (error) {
          results.mongodb = {
            status: 'unhealthy',
            message: 'MongoDB health check failed',
            error: error.message
          };
        }
      }

      // Neon PostgreSQL Health Check (if enabled)
      if (this.neonEnabled) {
        results.neon = await neonDB.healthCheck();
      }

      // Overall status
      const allHealthy = Object.values(results).every(db => db.status === 'healthy');
      
      return {
        status: allHealthy ? 'healthy' : 'partial',
        databases: results,
        message: allHealthy ? 'All databases healthy' : 'Some databases have issues'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database health check failed',
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new Database();