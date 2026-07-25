/**
 * Pure classification function.
 * Accepts an array of changed file paths and classifies the deployment into one of four change types:
 * 'infra' | 'dependency' | 'config' | 'code'
 *
 * Rules:
 * - package.json / pubspec.yaml (and standard dependency manifests) -> 'dependency'
 * - .env / docker-compose / nginx.conf -> 'config'
 * - terraform/ or k8s/ or ansible/ paths -> 'infra'
 * - anything else -> 'code'
 *
 * Precedence when multiple file categories are changed:
 * infra > dependency > config > code
 *
 * @param {string[]|string} changedFiles - Array of file paths or single file path string
 * @returns {'infra' | 'dependency' | 'config' | 'code'}
 */
function classify(changedFiles) {
  if (!changedFiles) {
    return 'code';
  }

  const filesArray = Array.isArray(changedFiles)
    ? changedFiles
    : [changedFiles];

  if (filesArray.length === 0) {
    return 'code';
  }

  const normalizedPaths = filesArray.map((file) =>
    typeof file === 'string' ? file.replace(/\\/g, '/').trim() : ''
  );

  let hasInfra = false;
  let hasDependency = false;
  let hasConfig = false;

  for (const path of normalizedPaths) {
    if (!path) continue;

    const lowerPath = path.toLowerCase();
    const basename = lowerPath.split('/').pop();

    // 1. Infra pattern rules: terraform/, k8s/, ansible/ in path or infra manifests
    if (
      lowerPath.includes('terraform/') ||
      lowerPath.includes('k8s/') ||
      lowerPath.includes('ansible/') ||
      lowerPath.includes('infra/') ||
      basename.endsWith('.tf') ||
      basename.endsWith('.k8s.yaml') ||
      basename.endsWith('.k8s.yml')
    ) {
      hasInfra = true;
      continue;
    }

    // 2. Dependency pattern rules: package.json, pubspec.yaml, lockfiles, etc.
    if (
      basename === 'package.json' ||
      basename === 'pubspec.yaml' ||
      basename === 'pubspec.yml' ||
      basename === 'package-lock.json' ||
      basename === 'yarn.lock' ||
      basename === 'pnpm-lock.yaml' ||
      basename === 'requirements.txt' ||
      basename === 'gemfile' ||
      basename === 'cargo.toml' ||
      basename === 'go.mod' ||
      basename === 'pipfile'
    ) {
      hasDependency = true;
      continue;
    }

    // 3. Config pattern rules: .env, docker-compose, nginx.conf, etc.
    if (
      basename === '.env' ||
      basename.startsWith('.env.') ||
      basename === 'docker-compose' ||
      basename === 'docker-compose.yml' ||
      basename === 'docker-compose.yaml' ||
      basename === 'nginx.conf' ||
      basename.endsWith('.config.js') ||
      basename.endsWith('.config.json')
    ) {
      hasConfig = true;
      continue;
    }
  }

  if (hasInfra) return 'infra';
  if (hasDependency) return 'dependency';
  if (hasConfig) return 'config';
  return 'code';
}

module.exports = classify;
