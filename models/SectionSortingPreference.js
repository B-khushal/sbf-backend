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
    const isOccasion = (this.section || '').startsWith('occasion:') || this.section === 'occasions';
    const rawData = {
      section: this.section,
      sortBy: this.sortBy || 'custom',
      sortDirection: this.sortDirection || 'asc',
      sequence: this.sequence || {},
      mode: isOccasion ? 'smart_rotation' : (this.mode || 'smart_rotation'),
      pinnedProductIds: isOccasion ? [] : (Array.isArray(this.pinnedProductIds) ? this.pinnedProductIds : []),
      protectedTopCount: Number(this.protectedTopCount !== undefined ? this.protectedTopCount : 0),
      rotationFrequency: this.rotationFrequency || (isOccasion ? 'hourly' : 'daily'),
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

    const cleanSec = section.trim().toLowerCase();
    const isBudget = cleanSec === 'budget_friendly' || cleanSec === 'budget-friendly' || cleanSec === 'category:budget-friendly' || cleanSec === 'category:budget_friendly' || cleanSec === 'under-1000' || cleanSec === 'category:under-1000';

    const searchSections = isBudget
      ? ['budget_friendly', 'category:budget-friendly', 'budget-friendly', 'category:budget_friendly']
      : [section];

    const orConditions = [];
    for (const s of searchSections) {
      orConditions.push({ id: `pref_${s}` });
      orConditions.push({ page: s });
    }

    const doc = await prisma.sectionSortingPreference.findFirst({
      where: {
        OR: orConditions
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
