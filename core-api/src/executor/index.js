const pm2Adapter = require('./pm2Adapter');

/**
 * Dispatcher for rollback actions based on target_type.
 *
 * @param {string} targetType - Target infrastructure ('pm2', 'docker', 'k8s')
 * @param {string} serviceName - Service or deployment identifier
 * @param {object} [configJson={}] - Additional configuration options
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
async function triggerRollback(targetType, serviceName, configJson = {}) {
  console.log(`[Executor] Initiating rollback dispatch. Target: ${targetType}, Service: ${serviceName}`);
  
  switch ((targetType || '').toLowerCase()) {
    case 'pm2':
      return await pm2Adapter(serviceName);
    case 'docker':
      return { success: true, message: `Docker rollback stub executed for ${serviceName}` };
    case 'k8s':
    case 'kubernetes':
      return { success: true, message: `Kubernetes rollback stub executed for ${serviceName}` };
    default:
      return { success: true, message: `Fallback rollback stub executed for target: ${targetType}` };
  }
}

module.exports = { triggerRollback };
