const express = require('express');
const router = express.Router();
const db = require('../db/client');

/**
 * POST /api/projects
 * Registers a new project.
 * Body: { name, target_type, service_name, config_json }
 */
router.post('/', async (req, res) => {
  try {
    const { name, target_type, service_name, config_json } = req.body;

    if (!name || !service_name) {
      return res.status(400).json({ error: 'name and service_name are required' });
    }

    const targetType = target_type || 'pm2';
    const config = config_json || {};

    const query = `
      INSERT INTO projects (name, target_type, service_name, config_json)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [name, targetType, service_name, JSON.stringify(config)];
    const result = await db.query(query, values);

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Project with this name already exists' });
    }
    console.error('[Projects Route] Error creating project:', err);
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * GET /api/projects
 * Retrieves all registered projects.
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM projects ORDER BY id DESC');
    return res.json(result.rows);
  } catch (err) {
    console.error('[Projects Route] Error fetching projects:', err);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

module.exports = router;
