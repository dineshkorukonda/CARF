const express = require('express');
const app = express();

app.use(express.json());

let statefulFail = false;

app.get('/health', (req, res) => {
  const isFail = req.query.fail === 'true' || statefulFail;
  const errorRate = isFail ? 15 : 0;
  return res.json({
    status: isFail ? 'degraded' : 'healthy',
    error_rate: errorRate,
  });
});

app.post('/toggle-fail', (req, res) => {
  if (typeof req.body.fail === 'boolean') {
    statefulFail = req.body.fail;
  } else {
    statefulFail = !statefulFail;
  }
  return res.json({ message: `Stateful fail mode set to ${statefulFail}`, fail: statefulFail });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[Demo Target App] Running on http://localhost:${PORT}`);
  console.log(`[Demo Target App] GET  http://localhost:${PORT}/health -> { error_rate: 0 }`);
  console.log(`[Demo Target App] GET  http://localhost:${PORT}/health?fail=true -> { error_rate: 15 }`);
});
