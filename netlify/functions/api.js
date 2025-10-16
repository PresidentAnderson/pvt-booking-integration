const serverless = require('serverless-http');
const app = require('../../api/index');

// Export the serverless handler
exports.handler = serverless(app, {
  binary: false,
  request: (request) => {
    // Add platform identifier
    request.netlify = true;
    return request;
  }
});