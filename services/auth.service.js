const bcrypt = require('bcrypt');
// Equal-cost comparison for unknown accounts avoids a fast account-existence signal.
const dummyHash = bcrypt.hash('not-a-real-password', 12);
exports.verify = async (db, email, password) => {
  const user = await db.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(
    password,
    user?.passwordHash || (await dummyHash)
  );
  return user?.active && valid ? user : null;
};
