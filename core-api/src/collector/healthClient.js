/**
 * Simple HTTP health client fetch wrapper.
 * GETs a health URL and extracts { error_rate } from the response.
 *
 * @param {string} url - Target health check endpoint URL
 * @returns {Promise<{ error_rate: number, error?: string }>}
 */
async function fetchHealth(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      try {
        const data = await response.json();
        if (typeof data.error_rate === 'number') {
          return { error_rate: data.error_rate };
        }
      } catch (_) {}
      return { error_rate: 100, error: `HTTP ${response.status} ${response.statusText}` };
    }
    const data = await response.json();
    return {
      error_rate: typeof data.error_rate === 'number' ? data.error_rate : 0,
    };
  } catch (err) {
    return { error_rate: 100, error: err.message };
  }
}

module.exports = { fetchHealth };
