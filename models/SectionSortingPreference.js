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
      sequence: this.sequence || {},
      mode: this.mode || 'smart_rotation',
      pinnedProductIds: Array.isArray(this.pinnedProductIds) ? this.pinnedProductIds : [],
      protectedTopCount: Number(this.protectedTopCount !== undefined ? this.protectedTopCount : 4),
      rotationFrequency: this.rotationFrequency || 'daily',
      rotationVersion: Number(this.rotationVersion || 1),
      isRotationEnabled: this.isRotationEnabled !== false,
      isPersonalizationEnabled: this.isPersonalizationEnabled !== false,
      excludedProductIds: Array.isArray(this.excludedProductIds) ? this.excludedProductIds : [],
      minDataThreshold: Number(this.minDataThreshold || 2),
      scoringWeights: this.scoringWeights || null,
      updatedAt: new Date().toISOString()
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
  static async find(where = {}) {
    try {
      const docs = await prisma.sectionSortingPreference.findMany();
      return docs.map(d => new SectionSortingPreferenceDocument(d));
    } catch (err) {
      console.error('Error fetching SectionSortingPreferences:', err);
      return [];
    }
  }

  static async findOne(where = {}) {
    let section = 'home';
    if (typeof where === 'string') {
      section = where;
    } else if (where && typeof where.section === 'string') {
      section = where.section;
    } else if (where && typeof where.page === 'string') {
      section = where.page;
    }
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
