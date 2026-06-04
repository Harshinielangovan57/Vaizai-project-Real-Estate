require('dotenv').config();
const express = require('express');
const app     = express();
const authRoutes = require('./auth/authRoutes');
const propertyRoutes = require('./properties/propertyRoutes');
const marketplaceCtrl = require('./marketplace/marketplaceController');
const marketplaceRoutes = require('./marketplace/marketplaceRoutes');
const escrowRoutes = require('./escrow/escrowRoutes');


app.post('/api/marketplace/webhook/stripe',
  express.raw({ type: 'application/json' }),
  marketplaceCtrl.stripeWebhook
);

app.use(express.json());

// Routes
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/escrow', escrowRoutes);

const agreementRoutes = require('./agreements/agreementRoutes');
app.use('/api/agreements', agreementRoutes);

const valuationRoutes = require('./ai-valuation/valuationRoutes');
app.use('/api/valuation', valuationRoutes);

const adminRoutes = require('./admin/adminRoutes');
app.use('/api/admin', adminRoutes);

module.exports = app;


