const prisma = require('../config/prisma');

class EmailLogDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(e => new EmailLogDocument(e)));
      else if (res) resolve(new EmailLogDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class EmailLogModel {
  static find(where = {}) {
    const filter = {};
    if (where.recipient) filter.recipient = where.recipient;
    if (where.status) filter.status = where.status;

    const query = prisma.emailLog.findMany({
      where: filter,
      orderBy: { sentAt: 'desc' }
    });
    return new QueryChain(query);
  }

  static async create(data) {
    const created = await prisma.emailLog.create({
      data: {
        id: data.id || data._id || `eml_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        recipient: data.recipient || data.to || 'unknown@recipient.com',
        subject: data.subject || 'Email',
        type: data.type || null,
        status: data.status || 'sent',
        error: data.error || null,
        metadata: data.metadata ? data.metadata : null
      }
    });
    return new EmailLogDocument(created);
  }

  static async countDocuments(where = {}) {
    return await prisma.emailLog.count({ where });
  }
}

module.exports = EmailLogModel;
