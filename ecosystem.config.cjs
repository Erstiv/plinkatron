module.exports = {
  apps: [
    {
      name: "plinkatron",
      script: "dist/index.mjs",
      cwd: "/var/www/plinkatron",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
