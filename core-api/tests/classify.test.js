const classify = require('../src/classifier/classify');

describe('classify.js Unit Tests', () => {
  describe('Dependency Change Type (at least 3 test cases)', () => {
    test('classifies package.json as dependency', () => {
      expect(classify(['package.json'])).toBe('dependency');
    });

    test('classifies pubspec.yaml as dependency', () => {
      expect(classify(['pubspec.yaml'])).toBe('dependency');
    });

    test('classifies nested lockfile (e.g. frontend/package-lock.json) as dependency', () => {
      expect(classify(['frontend/package-lock.json'])).toBe('dependency');
    });

    test('classifies python requirements.txt as dependency', () => {
      expect(classify(['backend/requirements.txt'])).toBe('dependency');
    });

    test('classifies rust Cargo.toml as dependency', () => {
      expect(classify(['Cargo.toml'])).toBe('dependency');
    });
  });

  describe('Config Change Type (at least 3 test cases)', () => {
    test('classifies .env file as config', () => {
      expect(classify(['.env'])).toBe('config');
    });

    test('classifies .env.production as config', () => {
      expect(classify(['config/.env.production'])).toBe('config');
    });

    test('classifies docker-compose.yml as config', () => {
      expect(classify(['docker-compose.yml'])).toBe('config');
    });

    test('classifies nginx.conf as config', () => {
      expect(classify(['etc/nginx/nginx.conf'])).toBe('config');
    });
  });

  describe('Infra Change Type (at least 3 test cases)', () => {
    test('classifies files in terraform/ path as infra', () => {
      expect(classify(['terraform/main.tf'])).toBe('infra');
    });

    test('classifies files in k8s/ path as infra', () => {
      expect(classify(['k8s/deployment.yaml'])).toBe('infra');
    });

    test('classifies files in ansible/ path as infra', () => {
      expect(classify(['ansible/playbooks/site.yml'])).toBe('infra');
    });

    test('classifies standalone .tf files as infra', () => {
      expect(classify(['deploy/aws_provider.tf'])).toBe('infra');
    });
  });

  describe('Code Change Type (at least 3 test cases)', () => {
    test('classifies JavaScript source files as code', () => {
      expect(classify(['src/server.js', 'src/routes/api.js'])).toBe('code');
    });

    test('classifies Python source files as code', () => {
      expect(classify(['app/controllers/user.py'])).toBe('code');
    });

    test('classifies documentation or markdown files as code', () => {
      expect(classify(['README.md', 'docs/architecture.md'])).toBe('code');
    });

    test('classifies empty file list as code', () => {
      expect(classify([])).toBe('code');
    });
  });

  describe('Precedence & Edge Cases', () => {
    test('prioritizes infra over dependency and config', () => {
      expect(classify(['package.json', '.env', 'terraform/main.tf'])).toBe('infra');
    });

    test('prioritizes dependency over config', () => {
      expect(classify(['package.json', '.env'])).toBe('dependency');
    });

    test('handles single string input gracefully', () => {
      expect(classify('.env')).toBe('config');
    });
  });
});
