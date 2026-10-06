module.exports = {
  apps: [
    {
      name: "sample-pm2-app",
      script: "./current/server.mjs",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "150M",
      env: {
        NODE_ENV: "production",
        PORT: 3301,
      },
    },
  ],
};
