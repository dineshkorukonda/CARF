module.exports = {
  apps: [
    {
      name: "demo-target-app",
      script: "./src/server.js",
      instances: 2,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        FAIL_MODE: "normal",
      },
    },
  ],
};
