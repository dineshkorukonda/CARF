const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const projectsRouter = require('./routes/projects');
const deploymentsRouter = require('./routes/deployments');
const { startPoller } = require('./collector/poller');

const app = express();

app.use(express.json());

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/deployments', deploymentsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'CARF Core API' });
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[CARF Core API] Server running on http://localhost:${PORT}`);
    startPoller(10000);
  });
}

module.exports = app;
