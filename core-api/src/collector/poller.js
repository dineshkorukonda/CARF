const db = require('../db/client');
const { fetchHealth } = require('./healthClient');
const decide = require('../engine/decide');
const { triggerRollback } = require('../executor');

let intervalId = null;

/**
 * Executes a single polling iteration over all deployments currently in 'observing' status.
 */
async function pollOnce() {
  try {
    const res = await db.query(
      `SELECT d.*, p.target_type, p.service_name 
       FROM deployments d
       JOIN projects p ON d.project_id = p.id
       WHERE d.status = $1`,
      ['observing']
    );

    const observingDeployments = res.rows;
    if (observingDeployments.length === 0) return;

    for (const dep of observingDeployments) {
      try {
        const createdAt = new Date(dep.created_at).getTime();
        const elapsedSeconds = Math.floor((Date.now() - createdAt) / 1000);

        const health = await fetchHealth(dep.health_check_url);
        const errorRate = health.error_rate;

        // Record metric reading in database
        await db.query(
          `INSERT INTO metric_readings (deployment_id, error_rate) VALUES ($1, $2)`,
          [dep.id, errorRate]
        );

        // Evaluate decision engine
        const decision = decide(dep.change_type, errorRate, elapsedSeconds);

        if (decision === 'rollback_triggered') {
          // Update status to rollback_triggered
          await db.query(
            `UPDATE deployments SET status = $1, updated_at = NOW() WHERE id = $2::integer`,
            ['rollback_triggered', dep.id]
          );

          const reason = `Error rate reading (${errorRate}%) breached threshold for change type '${dep.change_type}'.`;
          
          // Invoke executor
          const execResult = await triggerRollback(dep.target_type, dep.service_name);
          const executorStatus = execResult.success ? 'success' : 'failed';

          // Record rollback event
          await db.query(
            `INSERT INTO rollback_events (deployment_id, reason, executor_status, details)
             VALUES ($1, $2, $3, $4)`,
            [dep.id, reason, executorStatus, JSON.stringify(execResult)]
          );

          // Update final deployment status to rolled_back
          await db.query(
            `UPDATE deployments SET status = $1, updated_at = NOW() WHERE id = $2::integer`,
            ['rolled_back', dep.id]
          );

          console.log(`[Poller] Rollback executed for deployment #${dep.id} (${dep.change_type}).`);
        } else if (decision === 'stable') {
          await db.query(
            `UPDATE deployments SET status = $1, updated_at = NOW() WHERE id = $2::integer`,
            ['stable', dep.id]
          );
          console.log(`[Poller] Deployment #${dep.id} reached stability window.`);
        } else {
          await db.query(
            `UPDATE deployments SET updated_at = NOW() WHERE id = $1::integer`,
            [dep.id]
          );
        }
      } catch (err) {
        console.error(`[Poller] Error evaluating deployment #${dep.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Poller] Poller iteration failed:', err);
  }
}

/**
 * Starts the background polling interval loop.
 *
 * @param {number} [intervalMs=10000] - Polling frequency in milliseconds
 */
function startPoller(intervalMs = 10000) {
  if (intervalId) return;
  console.log(`[Poller] Starting background poller loop (interval: ${intervalMs}ms)...`);
  pollOnce();
  intervalId = setInterval(pollOnce, intervalMs);
}

/**
 * Stops the background polling interval loop.
 */
function stopPoller() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Poller] Stopped background poller loop.');
  }
}

module.exports = { startPoller, stopPoller, pollOnce };
