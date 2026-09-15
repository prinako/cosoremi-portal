const bcrypt = require('bcrypt');
const { audit } = require('./content.service');
const { httpError } = require('../utils/http');
exports.safeSelect = {
  id: true,
  name: true,
  email: true,
  active: true,
  role: true,
  createdAt: true,
};
exports.save = async (db, id, input, actorId) => {
  const { password, ...data } = input;
  if (!id && !password)
    throw httpError(422, 'Informe uma senha para o novo usuário.');
  if (password) data.passwordHash = await bcrypt.hash(password, 12);
  return db.$transaction(async (tx) => {
    // Serialize all account changes so concurrent demotions cannot remove the final administrator.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(84301921)`;
    if (id) {
      const old = await tx.user.findUniqueOrThrow({ where: { id } });
      if (
        old.active &&
        old.role === 'SUPER_ADMIN' &&
        (!data.active || data.role !== 'SUPER_ADMIN')
      ) {
        if (
          (await tx.user.count({
            where: { active: true, role: 'SUPER_ADMIN' },
          })) <= 1
        )
          throw httpError(422, 'Mantenha pelo menos um SUPER_ADMIN ativo.');
      }
      data.sessionVersion = { increment: 1 };
    }
    const item = id
      ? await tx.user.update({
          where: { id },
          data,
          select: exports.safeSelect,
        })
      : await tx.user.create({ data, select: exports.safeSelect });
    await audit(
      tx,
      actorId,
      id ? 'USER_UPDATED' : 'USER_CREATED',
      'user',
      item.id
    );
    return item;
  });
};
