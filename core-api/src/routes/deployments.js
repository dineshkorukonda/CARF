const express = require('express');
const router = express.Router();
const db = require('../db/client');
const classify = require('../classifier/classify');

/**
 * POST /api/deployments
 * Registers a new deployment, runs file classifier, sets status='observing'.
 * Body: { project_id, changed_files, commit_sha, health_check_url }
 */
router.post('/', async (req, res) => {
  try {
    const { project_id, changed_files, commit_sha, health_check_url } = req.body;

    if (!project_id || !health_check_url) {
      return res.status(400).json({ error: 'project_id and health_check_url are required' });
    }

    // Verify project exists
    const projCheck = await db.query('SELECT id FROM projects WHERE id = $1', [project_id]);
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ error: `Project with id ${project_id} not found` });
    }

    const files = Array.isArray(changed_files) ? changed_files : [];
    const changeType = classify(files);
    const commitSha = commit_sha || 'head';

    const insertQuery = `
      INSERT INTO deployments (project_id, commit_sha, changed_files, change_type, health_check_url, status)
      VALUES ($1, $2, $3, $4, $5, 'observing')
      RETURNING *;
    `;
    const values = [project_id, commitSha, JSON.stringify(files), changeType, health_check_url];
    const result = await db.query(insertQuery, values);

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Deployments Route] Error creating deployment:', err);
    return res.status(500).json({ error: 'Failed to create deployment' });
  }
});

/**
 * GET /api/deployments/:id
 * Retrieves details, metric readings, and rollback events for a specific deployment.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const depRes = await db.query(
      `SELECT d.*, p.name as project_name, p.target_type, p.service_name 
       FROM deployments d
       JOIN projects p ON d.project_id = p.id
       WHERE d.id = $1`,
      [id]
    );

    if (depRes.rows.length === 0) {
      return res.status(404).json({ error: `Deployment with id ${id} not found` });
    }

    const deployment = depRes.rows[0];

    const metricsRes = await db.query(
      `SELECT id, error_rate, recorded_at FROM metric_readings WHERE deployment_id = $1 ORDER BY recorded_at ASC`,
      [id]
    );

    const rollbackRes = await db.query(
      `SELECT id, reason, executor_status, details, triggered_at FROM rollback_events WHERE deployment_id = $1 ORDER BY triggered_at DESC`,
      [id]
    );

    return res.json({
      ...deployment,
      metric_readings: metricsRes.rows,
      rollback_events: rollbackRes.rows,
    });
  } catch (err) {
    console.error('[Deployments Route] Error fetching deployment details:', err);
    return res.status(500).json({ error: 'Failed to fetch deployment details' });
  }
});

/**
 * GET /api/deployments
 * Lists all deployments.
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, p.name as project_name 
       FROM deployments d
       JOIN projects p ON d.project_id = p.id
       ORDER BY d.id DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[Deployments Route] Error fetching deployments:', err);
    return res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

module.exports = router;
