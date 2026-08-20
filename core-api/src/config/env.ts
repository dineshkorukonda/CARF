function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  githubAppId: () => requireEnv("GITHUB_APP_ID"),
  githubAppPrivateKey: () => requireEnv("GITHUB_APP_PRIVATE_KEY"),
  githubWebhookSecret: () => requireEnv("GITHUB_WEBHOOK_SECRET"),
};
