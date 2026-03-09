module.exports = {
  port: process.env.PORT || 3001,
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'fresher-dev-secret',
  dataPath: process.env.DATA_PATH || 'data/store.json'
};
