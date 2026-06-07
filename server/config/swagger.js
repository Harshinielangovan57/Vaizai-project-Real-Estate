const swaggerJsdoc  = require('swagger-jsdoc');
const swaggerUi     = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'RealEstate NFT API',
      version:     '1.0.0',
      description: 'API documentation for Real Estate NFT Marketplace',
      contact: {
        name:  'RealNFT Dev Team',
        email: 'dev@realnft.com',
      },
    },
    servers: [
      {
        url:         'http://localhost:5000',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        // ── Auth ──────────────────────────────────────────────────
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            name:     { type: 'string',  example: 'John Doe' },
            email:    { type: 'string',  example: 'john@example.com' },
            password: { type: 'string',  example: 'Secret@123' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', example: 'john@example.com' },
            password: { type: 'string', example: 'Secret@123' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id:    { type: 'string' },
                name:  { type: 'string' },
                email: { type: 'string' },
                role:  { type: 'string', enum: ['user', 'seller', 'admin'] },
              },
            },
          },
        },

        // ── Property ──────────────────────────────────────────────
        Property: {
          type: 'object',
          properties: {
            _id:          { type: 'string' },
            title:        { type: 'string' },
            address:      { type: 'string' },
            city:         { type: 'string' },
            state:        { type: 'string' },
            squareFeet:   { type: 'number' },
            bedrooms:     { type: 'number' },
            bathrooms:    { type: 'number' },
            askingPrice:  { type: 'number' },
            propertyType: { type: 'string', enum: ['residential','commercial','land','industrial'] },
            tokenized:    { type: 'boolean' },
            verified:     { type: 'boolean' },
            tokenId:      { type: 'number' },
            aiValuation:  { type: 'number' },
            forSale:      { type: 'boolean' },
            forAuction:   { type: 'boolean' },
            primaryImage: { type: 'string' },
          },
        },

        // ── Listing ───────────────────────────────────────────────
        Listing: {
          type: 'object',
          properties: {
            _id:           { type: 'string' },
            listingId:     { type: 'number' },
            tokenId:       { type: 'number' },
            priceEth:      { type: 'number' },
            priceUsd:      { type: 'number' },
            active:        { type: 'boolean' },
            sellerAddress: { type: 'string' },
          },
        },

        // ── Escrow ────────────────────────────────────────────────
        Escrow: {
          type: 'object',
          properties: {
            _id:            { type: 'string' },
            escrowId:       { type: 'number' },
            status:         { type: 'string', enum: ['pending','funded','in_progress','completed','disputed','refunded','cancelled'] },
            totalAmountEth: { type: 'number' },
            buyerAddress:   { type: 'string' },
            sellerAddress:  { type: 'string' },
          },
        },

        // ── Auction ───────────────────────────────────────────────
        Auction: {
          type: 'object',
          properties: {
            _id:              { type: 'string' },
            auctionId:        { type: 'number' },
            status:           { type: 'string', enum: ['scheduled','live','ended','settled','cancelled'] },
            startingPriceEth: { type: 'number' },
            highestBidEth:    { type: 'number' },
            endTime:          { type: 'string', format: 'date-time' },
          },
        },

        // ── Error ─────────────────────────────────────────────────
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    './auth/authRoutes.js',
    './properties/propertyRoutes.js',
    './marketplace/marketplaceRoutes.js',
    './escrow/escrowRoutes.js',
    './auction/auctionRoutes.js',
    './agreements/agreementRoutes.js',
    './ai-valuation/valuationRoutes.js',
    './admin/adminRoutes.js',
    './routes/config.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec, swaggerUi };