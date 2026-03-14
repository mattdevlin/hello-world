import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import db from './db.js';
import { seed } from './seeds/defaultPricing.js';
import { errorHandler } from './middleware/errorHandler.js';
import pricingRoutes from './routes/pricing.js';
import marginsRoutes from './routes/margins.js';
import settingsRoutes from './routes/settings.js';

// Seed default data (idempotent)
seed(db);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/pricing', pricingRoutes);
app.use('/api/margins', marginsRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`DEVPRO Quote Server running on port ${PORT}`);
});

export default app;
