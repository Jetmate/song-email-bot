module.exports = {
  apps: [{
    name: 'email-bot',
    script: 'build/main.js',
    watch: true,
    env: {'NODE_ENV': 'production'}
  }]
}
