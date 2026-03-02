module.exports = {
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    restoreMocks: true,
    clearMocks: true,
    globals: true,
  },
};
