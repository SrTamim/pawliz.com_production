module.exports = {
  apps: [
    {
      name: "pawliz",
      script: "server.js",
      cwd: "L:/Projects/PAWLY/pawliz/backend",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "development",
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: "5s",
    },
  ],
};
