const { exec } = require('child_process');

/**
 * PM2 reload adapter. Runs `pm2 reload <service_name>` via child_process.exec.
 * Returns a promise resolving on success or failure.
 *
 * @param {string} serviceName - PM2 app/service name to reload
 * @returns {Promise<{ success: boolean, stdout?: string, stderr?: string, error?: string }>}
 */
function pm2Adapter(serviceName) {
  return new Promise((resolve) => {
    if (!serviceName) {
      return resolve({ success: false, error: 'Service name is required for PM2 adapter' });
    }
    exec(`pm2 reload ${serviceName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[PM2 Adapter] Reload failed for '${serviceName}':`, stderr || error.message);
        return resolve({ success: false, error: error.message, stdout, stderr });
      }
      console.log(`[PM2 Adapter] Reload succeeded for '${serviceName}':`, stdout);
      return resolve({ success: true, stdout, stderr });
    });
  });
}

module.exports = pm2Adapter;
