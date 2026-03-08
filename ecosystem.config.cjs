module.exports = {
  apps: [
    {
      name: "plinkatron",
      script: "dist/index.cjs",
      cwd: "/var/www/plinkatron",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3004,
      },
      env_file: "/var/www/plinkatron/.env",
    },
  ],
};
