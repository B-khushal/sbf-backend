const prisma = require('../config/prisma');

function cleanHolidayWhere(where = {}) {
  const clean = {};
  if (!where || typeof where !== 'object') return clean;

  if (where.year) {
    const y = parseInt(where.year);
    clean.OR = [
      { year: y },
      {
        date: {
          gte: new Date(y, 0, 1),
          lte: new Date(y, 11, 31, 23, 59, 59, 999)
        }
      }
    ];
  }

  if (where.month !== undefined) {
    clean.month = parseInt(where.month);
  }

  if (where.day !== undefined) {
    clean.day = parseInt(where.day);
  }

  if (where._id || where.id) {
    const idVal = where._id || where.id;
    if (typeof idVal === 'object' && idVal !== null) {
      if (idVal.$ne) {
        clean.id = { not: String(idVal.$ne) };
      }
    } else if (idVal) {
      clean.id = String(idVal);
    }
  }

  if (where.isActive !== undefined) {
    clean.isActive = where.isActive === true || where.isActive === 'true';
  }

  if (where.category) {
    clean.category = String(where.category);
  }

  if (where.type) {
    clean.type = String(where.type);
  }

  return clean;
}

class HolidayDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.name = data.name || data.title || 'Holiday';
    this.title = data.title || data.name || 'Holiday';
    this.reason = data.reason || data.description || '';
    this.description = data.description || data.reason || '';
    this.type = data.type || 'store';
    this.category = data.category || 'national';
    this.isRecurring = data.isRecurring === true || data.recurring === true;
    this.recurring = this.isRecurring;
    this.recurringYears = data.recurringYears || [];
    this.isActive = this.isActive !== false;

    // Compute year/month/day from date
    const d = this.date ? new Date(this.date) : new Date();
    this.year = d.getFullYear();
    this.month = d.getMonth() + 1;
    this.day = d.getDate();

    this.createdBy = (data.createdBy && typeof data.createdBy === 'object')
      ? data.createdBy
      : { _id: String(data.createdBy || '67e94ba835eb20eee3feba0e'), name: 'SBF Admin', email: 'admin@sbf.com' };
  }

  checkIsRecurring() {
    return (this.isRecurring || this.recurring) && Array.isArray(this.recurringYears) && this.recurringYears.length > 0;
  }

  getNextOccurrence() {
    if (!this.isRecurring && !this.recurring) return null;
    const currentYear = new Date().getFullYear();
    const years = Array.isArray(this.recurringYears) ? this.recurringYears : [];
    const nextYear = years.find(y => y > currentYear);
    if (nextYear) {
      return new Date(nextYear, this.month - 1, this.day);
    }
    return null;
  }

  async save() {
    const id = this.id || this._id;
    const updated = await prisma.holiday.upsert({
      where: { id: id || `hol_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` },
      update: {
        title: this.title || this.name,
        name: this.name || this.title,
        date: this.date ? new Date(this.date) : new Date(),
        description: this.description || this.reason || null,
        reason: this.reason || this.description || null,
        type: this.type || 'store',
        category: this.category || 'other',
        isActive: this.isActive !== false,
        isRecurring: this.isRecurring === true || this.recurring === true,
        recurring: this.isRecurring === true || this.recurring === true,
        recurringYears: this.recurringYears || [],
        year: this.year,
        month: this.month,
        day: this.day,
        createdBy: typeof this.createdBy === 'string' ? this.createdBy : (this.createdBy?.id || 'admin')
      },
      create: {
        id: id || `hol_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: this.title || this.name || 'Holiday',
        name: this.name || this.title || 'Holiday',
        date: this.date ? new Date(this.date) : new Date(),
        description: this.description || this.reason || null,
        reason: this.reason || this.description || null,
        type: this.type || 'store',
        category: this.category || 'other',
        isActive: this.isActive !== false,
        isRecurring: this.isRecurring === true || this.recurring === true,
        recurring: this.isRecurring === true || this.recurring === true,
        recurringYears: this.recurringYears || [],
        year: this.year,
        month: this.month,
        day: this.day,
        createdBy: typeof this.createdBy === 'string' ? this.createdBy : (this.createdBy?.id || 'admin')
      }
    });
    Object.assign(this, updated);
    this._id = updated.id;
    return this;
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id || this._id,
      title: this.title,
      name: this.name,
      reason: this.reason,
      description: this.description,
      date: this.date,
      type: this.type,
      category: this.category,
      year: this.year,
      month: this.month,
      day: this.day,
      isRecurring: this.isRecurring,
      recurring: this.recurring,
      recurringYears: this.recurringYears,
      isActive: this.isActive,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  populate() { return this; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  select() { return this; }
  lean() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(h => new HolidayDocument(h)));
      else if (res) resolve(new HolidayDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class HolidayModel {
  constructor(data = {}) {
    return new HolidayDocument(data);
  }

  static find(where = {}) {
    const filter = cleanHolidayWhere(where);
    const query = prisma.holiday.findMany({ where: filter, orderBy: { date: 'asc' } });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = cleanHolidayWhere(where);
    const query = prisma.holiday.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.holiday.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async create(data) {
    const doc = new HolidayDocument(data);
    await doc.save();
    return doc;
  }

  static async findByIdAndUpdate(id, update) {
    const dataToUpdate = update.$set ? update.$set : update;
    try {
      const updatePayload = {};
      if (dataToUpdate.title || dataToUpdate.name) {
        updatePayload.title = dataToUpdate.title || dataToUpdate.name;
        updatePayload.name = dataToUpdate.name || dataToUpdate.title;
      }
      if (dataToUpdate.description !== undefined || dataToUpdate.reason !== undefined) {
        updatePayload.description = dataToUpdate.description || dataToUpdate.reason;
        updatePayload.reason = dataToUpdate.reason || dataToUpdate.description;
      }
      if (dataToUpdate.type !== undefined) {
        updatePayload.type = dataToUpdate.type;
      }
      if (dataToUpdate.category !== undefined) {
        updatePayload.category = dataToUpdate.category;
      }
      if (dataToUpdate.isActive !== undefined) {
        updatePayload.isActive = Boolean(dataToUpdate.isActive);
      }
      if (dataToUpdate.isRecurring !== undefined || dataToUpdate.recurring !== undefined) {
        const isRec = dataToUpdate.isRecurring !== undefined ? Boolean(dataToUpdate.isRecurring) : Boolean(dataToUpdate.recurring);
        updatePayload.isRecurring = isRec;
        updatePayload.recurring = isRec;
      }
      if (dataToUpdate.recurringYears !== undefined) {
        updatePayload.recurringYears = dataToUpdate.recurringYears;
      }
      if (dataToUpdate.date) {
        const d = new Date(dataToUpdate.date);
        updatePayload.date = d;
        updatePayload.year = d.getFullYear();
        updatePayload.month = d.getMonth() + 1;
        updatePayload.day = d.getDate();
      }

      const updated = await prisma.holiday.update({
        where: { id: String(id) },
        data: updatePayload
      });
      return new HolidayDocument(updated);
    } catch (e) {
      console.error('Error updating holiday by ID:', e);
      return null;
    }
  }

  static async findByIdAndDelete(id) {
    try {
      const deleted = await prisma.holiday.delete({ where: { id: String(id) } });
      return new HolidayDocument(deleted);
    } catch (e) {
      return null;
    }
  }

  static async countDocuments(where = {}) {
    const filter = cleanHolidayWhere(where);
    return await prisma.holiday.count({ where: filter });
  }

  static async aggregate(pipeline = []) {
    let matchFilter = {};
    let groupByField = null;

    for (const stage of pipeline) {
      if (stage.$match) {
        matchFilter = { ...matchFilter, ...stage.$match };
      }
      if (stage.$group && stage.$group._id) {
        const rawGroup = stage.$group._id;
        if (typeof rawGroup === 'string' && rawGroup.startsWith('$')) {
          groupByField = rawGroup.substring(1);
        }
      }
    }

    const filter = cleanHolidayWhere(matchFilter);
    const holidays = await prisma.holiday.findMany({ where: filter });

    if (!groupByField) {
      return holidays.map(h => new HolidayDocument(h));
    }

    const counts = {};
    for (const item of holidays) {
      const val = item[groupByField] || 'other';
      counts[val] = (counts[val] || 0) + 1;
    }

    const result = Object.keys(counts).map(key => ({
      _id: key,
      count: counts[key]
    }));

    const sortStage = pipeline.find(s => s.$sort);
    if (sortStage && sortStage.$sort) {
      const sortKey = Object.keys(sortStage.$sort)[0];
      const sortOrder = sortStage.$sort[sortKey];
      if (sortKey === 'count') {
        result.sort((a, b) => sortOrder === -1 ? b.count - a.count : a.count - b.count);
      }
    }

    return result;
  }

  static async getHolidaysForYear(year) {
    const startOfYear = new Date(parseInt(year), 0, 1);
    const endOfYear = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
    const list = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      orderBy: { date: 'asc' }
    });
    return list.map(h => new HolidayDocument(h));
  }

  static async getHolidaysForDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const list = await prisma.holiday.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      orderBy: { date: 'asc' }
    });
    return list.map(h => new HolidayDocument(h));
  }

  static async getActiveHolidays() {
    const list = await prisma.holiday.findMany({
      where: { isActive: true },
      orderBy: { date: 'asc' }
    });
    return list.map(h => new HolidayDocument(h));
  }

  static async isHoliday(date) {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
    const item = await prisma.holiday.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
    return item ? new HolidayDocument(item) : null;
  }

  static populate() { return this; }
}

module.exports = HolidayModel;