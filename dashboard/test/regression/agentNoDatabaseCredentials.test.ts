import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Agent Zero Database Credentials Enforcement", () => {
  const agentPath = path.resolve(__dirname, "../../public/agent/agent.mjs");
  const installShPath = path.resolve(__dirname, "../../public/install.sh");

  it("ensures agent.mjs contains NO database credentials or connection strings", () => {
    const content = fs.readFileSync(agentPath, "utf-8");
    expect(content).not.toMatch(/DATABASE_URL/i);
    expect(content).not.toMatch(/postgres:\/\//i);
    expect(content).not.toMatch(/postgresql:\/\//i);
    expect(content).not.toMatch(/neon\.tech/i);
    expect(content).not.toMatch(/@prisma\/client/i);
  });

  it("ensures install.sh writes ONLY CARF_INSTALL_TOKEN and CARF_CENTRAL_API_URL to .env", () => {
    const content = fs.readFileSync(installShPath, "utf-8");
    expect(content).not.toMatch(/DATABASE_URL/i);
    expect(content).not.toMatch(/postgres:\/\//i);
    expect(content).not.toMatch(/postgresql:\/\//i);
    expect(content).not.toMatch(/neon\.tech/i);

    // Verify .env generation block only includes token and URL
    const envBlockMatch = content.match(/cat <<EOF > "\$AGENT_DIR\/\.env"([\s\S]*?)EOF/);
    expect(envBlockMatch).not.toBeNull();
    const envBlock = envBlockMatch![1]!;
    expect(envBlock).toContain("CARF_INSTALL_TOKEN=");
    expect(envBlock).toContain("CARF_CENTRAL_API_URL=");
    expect(envBlock).not.toContain("DATABASE");
    expect(envBlock).not.toContain("PASSWORD");
  });

  it("supports --token install and --uninstall without embedding database credentials", () => {
    const content = fs.readFileSync(installShPath, "utf-8");
    expect(content).toContain("--token=");
    expect(content).toContain("--uninstall");
    expect(content).toContain("pm2 start");
    expect(content).toContain("/agent/agent.mjs");
    expect(content).not.toMatch(/DATABASE_URL/i);
  });
});
