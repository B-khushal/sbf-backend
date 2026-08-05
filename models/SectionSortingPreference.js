const prisma = require('../config/prisma');

class SectionSortingPreferenceDocument {
  constructor(data) {
    if (data.preferences && typeof data.preferences === 'object') {
      Object.assign(this, data.preferences);
    } else {
      Object.assign(this, data);
    }
    this.section = data.page || data.section || 'home';
    this._id = data.id || `pref_${this.section}`;
  }

  async save() {
    const id = this._id || `pref_${this.section}`;
    const rawData = {
      section: this.section,
      sortBy: this.sortBy || 'custom',
      sortDirection: this.sortDirection || 'asc',
      sequence: this.sequence || {}
    };

    await prisma.sectionSortingPreference.upsert({
      where: { id },
      update: {
        page: this.section,
        preferences: rawData
      },
      create: {
        id,
        page: this.section,
        preferences: rawData
      }
    });

    return this;
  }
}

class SectionSortingPreferenceModel {
  static async findOne(where = {}) {
    const section = where.section || where.page || 'home';
    const id = `pref_${section}`;
    const doc = await prisma.sectionSortingPreference.findFirst({
      where: {
        OR: [
          { id },
          { page: section }
        ]
      }
    });
    if (doc) return new SectionSortingPreferenceDocument(doc);
    return null;
  }

  static async findOneAndUpdate(where = {}, update = {}, options = {}) {
    const section = where.section || where.page || 'home';
    const id = `pref_${section}`;
    let existing = await this.findOne({ section });
    const dataToUpdate = update.$set ? update.$set : update;

    if (!existing) {
      existing = new SectionSortingPreferenceDocument({
        id,
        section,
        sortBy: dataToUpdate.sortBy || 'custom',
        sortDirection: dataToUpdate.sortDirection || 'asc',
        ...dataToUpdate
      });
    } else {
      Object.assign(existing, dataToUpdate);
    }

    await existing.save();
    return existing;
  }
}

module.exports = SectionSortingPreferenceModel;
