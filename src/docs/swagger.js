const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Loyalty Rewards API',
      version: '1.0.0',
      description: 'API documentation for Loyalty Rewards (Products)'
    }
  },
  apis: [
    './src/routes/api/v1/admin/product.routes.js',
    './src/routes/api/v1/admin/reward.routes.js', 
    './src/routes/api/v1/admin/offer.routes.js', // path to offer routes
  ] // paths to annotations
  
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = {
  swaggerUi,
  swaggerSpec
};
