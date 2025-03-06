module.exports = {
  apps: [
    {
      name: 'nudgyt-api',
      script: './dist/index.js',
      instances: 'max',
      exec_mode: 'cluster'
    }
  ]
};
