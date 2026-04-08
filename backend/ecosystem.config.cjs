module.exports = {
  apps: [
    {
      name: 'knowledgeos-backend',
      cwd: '/home/parryh/apps/knowledgeos/backend',
      script: 'dist/backend/src/index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
