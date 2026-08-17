module.exports = {
  apps: [{
    name: "bot-promo",
    script: "./dist/index.js",
    max_memory_restart: "700M",
    env: {
      NODE_ENV: "production",
    }
  }]
}
