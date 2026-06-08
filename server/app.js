require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();

// ✅ CORS — first
// ✅ CORS — support dynamic localhost origins for local development
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);
    if (allowedOrigins.includes(origin) || isLocalhost) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// ✅ Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Routes
const authRoutes        = require('./auth/authRoutes');
const propertyRoutes    = require('./properties/propertyRoutes');
const marketplaceRoutes = require('./marketplace/marketplaceRoutes');
const marketplaceCtrl   = require('./marketplace/marketplaceController');
const escrowRoutes      = require('./escrow/escrowRoutes');
const agreementRoutes   = require('./agreements/agreementRoutes');
const valuationRoutes   = require('./ai-valuation/valuationRoutes');
const adminRoutes       = require('./admin/adminRoutes');
const auctionRoutes     = require('./auction/auctionRoutes');
const configRoutes      = require('./routes/config');

app.use('/api/auth',        authRoutes);
app.use('/api/properties',  propertyRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/escrow',      escrowRoutes);
app.use('/api/agreements',  agreementRoutes);
app.use('/api/valuation',   valuationRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/auctions',    auctionRoutes);
app.use('/api/config',      configRoutes);
app.use('/api/properties', require('./routes/properties'));

// ✅ Stripe webhook — must use raw body
app.post(
  '/api/marketplace/webhook/stripe',
  express.raw({ type: 'application/json' }),
  marketplaceCtrl.stripeWebhook
);

// Add after other requires at top of app.js
const { swaggerSpec, swaggerUi } = require('./config/swagger');

// Add after body parsers, before routes
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'RealNFT API Docs',
  customCss: '.swagger-ui .topbar { background-color: #4f46e5; }',
  swaggerOptions: {
    persistAuthorization: true,   // keeps JWT token between page refreshes
  },
}));

// Expose raw JSON spec for external tools (Postman, Insomnia)
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;