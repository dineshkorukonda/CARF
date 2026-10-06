import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ENV_DIR = path.resolve(__dirname, "../../../environments");

describe("Stage 1 — Target Environments Matrix Validation", () => {
  describe("Environment A: PM2", () => {
    it("provides valid multi-version apps and ecosystem configuration", () => {
      const pm2Dir = path.join(ENV_DIR, "pm2");
      expect(fs.existsSync(path.join(pm2Dir, "app", "v1", "server.mjs"))).toBe(true);
      expect(fs.existsSync(path.join(pm2Dir, "app", "v2", "server.mjs"))).toBe(true);
      expect(fs.existsSync(path.join(pm2Dir, "app", "broken", "server.mjs"))).toBe(true);
      expect(fs.existsSync(path.join(pm2Dir, "ecosystem.config.cjs"))).toBe(true);
      expect(fs.existsSync(path.join(pm2Dir, "deploy.sh"))).toBe(true);
      expect(fs.existsSync(path.join(pm2Dir, "rollback.sh"))).toBe(true);
      expect(fs.existsSync(path.join(pm2Dir, "health-check.sh"))).toBe(true);
    });
  });

  describe("Environment B: Docker", () => {
    it("provides Dockerfile, compose.yml and lifecycle control scripts", () => {
      const dockerDir = path.join(ENV_DIR, "docker");
      expect(fs.existsSync(path.join(dockerDir, "Dockerfile"))).toBe(true);
      expect(fs.existsSync(path.join(dockerDir, "compose.yml"))).toBe(true);
      expect(fs.existsSync(path.join(dockerDir, "deploy.sh"))).toBe(true);
      expect(fs.existsSync(path.join(dockerDir, "rollback.sh"))).toBe(true);
      expect(fs.existsSync(path.join(dockerDir, "health-check.sh"))).toBe(true);

      const composeContent = fs.readFileSync(path.join(dockerDir, "compose.yml"), "utf8");
      expect(composeContent).toContain("sample-app");
      expect(composeContent).toContain("healthcheck");
    });
  });

  describe("Environment C: Kubernetes", () => {
    it("provides namespace, multi-version deployments, and rollback scripts", () => {
      const k8sDir = path.join(ENV_DIR, "kubernetes");
      expect(fs.existsSync(path.join(k8sDir, "namespace.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(k8sDir, "deployment-v1.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(k8sDir, "deployment-v2.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(k8sDir, "deployment-broken.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(k8sDir, "service.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(k8sDir, "rollback.sh"))).toBe(true);

      const v1Content = fs.readFileSync(path.join(k8sDir, "deployment-v1.yaml"), "utf8");
      expect(v1Content).toContain("readinessProbe");
      expect(v1Content).toContain("RollingUpdate");
    });
  });

  describe("Environment D: Argo Rollouts", () => {
    it("provides Rollout CRD with canary steps and AnalysisTemplate", () => {
      const argoDir = path.join(ENV_DIR, "argo-rollouts");
      expect(fs.existsSync(path.join(argoDir, "install.sh"))).toBe(true);
      expect(fs.existsSync(path.join(argoDir, "rollout-v1.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(argoDir, "rollout-v2.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(argoDir, "analysis-template.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(argoDir, "abort.sh"))).toBe(true);

      const v1Content = fs.readFileSync(path.join(argoDir, "rollout-v1.yaml"), "utf8");
      expect(v1Content).toContain("argoproj.io/v1alpha1");
      expect(v1Content).toContain("setWeight");
    });
  });

  describe("Environment E: Flagger", () => {
    it("provides Canary CRD with metric analysis and failure scripts", () => {
      const flaggerDir = path.join(ENV_DIR, "flagger");
      expect(fs.existsSync(path.join(flaggerDir, "install.sh"))).toBe(true);
      expect(fs.existsSync(path.join(flaggerDir, "canary.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(flaggerDir, "deploy.sh"))).toBe(true);
      expect(fs.existsSync(path.join(flaggerDir, "trigger-failure.sh"))).toBe(true);

      const canaryContent = fs.readFileSync(path.join(flaggerDir, "canary.yaml"), "utf8");
      expect(canaryContent).toContain("flagger.app/v1beta1");
      expect(canaryContent).toContain("targetRef");
    });
  });
});
