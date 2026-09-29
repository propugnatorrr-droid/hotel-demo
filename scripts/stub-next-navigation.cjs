module.exports = {
  unstable_rethrow() {},
  notFound() {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect(u) {
    throw new Error('NEXT_REDIRECT ' + u);
  },
};
