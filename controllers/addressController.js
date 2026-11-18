const { z } = require('zod');
const prisma = require('../config/prisma');
const {
  lookupPincode,
  normalizePincode,
  normalizeIndianPhone,
  isValidIndianMobile,
  sanitizeText,
  unpackNotesAndAltPhone,
  packNotesAndAltPhone,
} = require('../data/serviceablePincodes');

const addressPayloadSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required (at least 2 characters)').max(120).optional(),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  phone: z.string().trim().min(10, 'Enter a valid 10-digit Indian mobile number'),
  alternatePhone: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().max(180).optional().or(z.literal('')),
  houseNo: z.string().trim().max(120).optional().or(z.literal('')),
  apartment: z.string().trim().max(160).optional().or(z.literal('')),
  street: z.string().trim().max(240).optional().or(z.literal('')),
  address: z.string().trim().max(240).optional().or(z.literal('')),
  landmark: z.string().trim().max(160).optional().or(z.literal('')),
  floor: z.string().trim().max(60).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().min(2, 'State is required').max(80),
  pincode: z.string().trim().optional().or(z.literal('')),
  zipCode: z.string().trim().optional().or(z.literal('')),
  country: z.string().trim().max(60).optional(),
  type: z.enum(['home', 'work', 'other']).optional().default('home'),
  deliveryOption: z.enum(['self', 'gift']).optional().default('self'),
  deliveryInstructions: z.string().trim().max(250).optional().or(z.literal('')),
  notes: z.string().trim().max(250).optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  formattedAddress: z.string().trim().max(300).optional().or(z.literal('')),
  receiverFirstName: z.string().trim().max(60).optional().or(z.literal('')),
  receiverLastName: z.string().trim().max(60).optional().or(z.literal('')),
  receiverEmail: z.string().trim().max(180).optional().or(z.literal('')),
  receiverPhone: z.string().trim().max(20).optional().or(z.literal('')),
  receiverAddress: z.string().trim().max(240).optional().or(z.literal('')),
  receiverApartment: z.string().trim().max(160).optional().or(z.literal('')),
  receiverCity: z.string().trim().max(80).optional().or(z.literal('')),
  receiverState: z.string().trim().max(80).optional().or(z.literal('')),
  receiverZipCode: z.string().trim().max(10).optional().or(z.literal('')),
});

const serializeAddressRecord = (row) => {
  const rawName = (row.fullName || `${row.firstName || ''} ${row.lastName || ''}`).trim();
  const parts = rawName.split(/\s+/).filter(Boolean);
  const firstName = row.firstName || parts[0] || '';
  const lastName = row.lastName || parts.slice(1).join(' ') || '';
  const street = row.address || row.street || row.addressLine1 || row.formattedAddress || '';
  const zip = row.zipCode || row.pincode || '';
  const { notes: cleanNotes, alternatePhone } = unpackNotesAndAltPhone(row.notes);
  const instructions = row.deliveryInstructions || row.deliverySpecialInstructions || cleanNotes || '';
  const pinInfo = lookupPincode(zip);

  return {
    id: row.id,
    fullName: rawName || `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    phone: row.phone || '',
    alternatePhone,
    email: row.email || '',
    houseNo: row.houseNo || '',
    apartment: row.apartment || row.addressLine2 || '',
    street,
    address: street,
    addressLine1: street,
    addressLine2: row.apartment || row.addressLine2 || '',
    landmark: row.landmark || '',
    floor: row.floor || '',
    city: row.city || pinInfo?.city || 'Hyderabad',
    state: row.state || pinInfo?.state || 'Telangana',
    pincode: zip,
    zipCode: zip,
    country: row.country || 'India',
    type: ['home', 'work', 'other'].includes(String(row.type || '').toLowerCase())
      ? String(row.type).toLowerCase()
      : 'home',
    deliveryOption: row.deliveryOption === 'gift' ? 'gift' : 'self',
    deliveryInstructions: instructions,
    deliverySpecialInstructions: row.deliverySpecialInstructions || instructions,
    notes: cleanNotes,
    isDefault: Boolean(row.isDefault),
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    formattedAddress: row.formattedAddress || street,
    serviceable: Boolean(pinInfo),
    serviceArea: pinInfo?.area || null,
    receiverFirstName: row.receiverFirstName || '',
    receiverLastName: row.receiverLastName || '',
    receiverEmail: row.receiverEmail || '',
    receiverPhone: row.receiverPhone || '',
    receiverAddress: row.receiverAddress || '',
    receiverApartment: row.receiverApartment || '',
    receiverCity: row.receiverCity || '',
    receiverState: row.receiverState || '',
    receiverZipCode: row.receiverZipCode || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const fetchUserAddresses = async (userId) => {
  const rows = await prisma.address.findMany({
    where: { userId: String(userId) },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });
  return rows.map(serializeAddressRecord);
};

const validateAndBuildAddressData = (body) => {
  const parsed = addressPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstMsg = Object.values(fieldErrors).flat()[0] || 'Invalid address data';
    return { error: firstMsg, fieldErrors };
  }

  const data = parsed.data;
  const fullName = sanitizeText(data.fullName || `${data.firstName || ''} ${data.lastName || ''}`, 120);
  if (fullName.length < 2) {
    return { error: 'Full name is required', fieldErrors: { fullName: ['Full name is required'] } };
  }

  if (!isValidIndianMobile(data.phone)) {
    return {
      error: 'Please enter a valid 10-digit Indian mobile number starting with 6-9',
      fieldErrors: { phone: ['Enter a valid 10-digit Indian mobile number'] },
    };
  }

  if (data.alternatePhone && data.alternatePhone.trim() && !isValidIndianMobile(data.alternatePhone)) {
    return {
      error: 'Alternate mobile number must be a valid 10-digit Indian mobile number',
      fieldErrors: { alternatePhone: ['Enter a valid 10-digit Indian mobile number'] },
    };
  }

  const zip = normalizePincode(data.pincode || data.zipCode || '');
  if (!/^\d{6}$/.test(zip)) {
    return {
      error: 'Please enter a valid 6-digit PIN code',
      fieldErrors: { pincode: ['Enter a valid 6-digit PIN code'] },
    };
  }

  const pinInfo = lookupPincode(zip);
  if (!pinInfo) {
    return {
      error: `Sorry, we currently deliver across Hyderabad & Secunderabad only. PIN code ${zip} is outside our delivery area.`,
      fieldErrors: { pincode: [`PIN code ${zip} is currently not serviceable`] },
    };
  }

  const streetVal = sanitizeText(data.street || data.address || data.formattedAddress || '', 240);
  if (streetVal.length < 3) {
    return {
      error: 'Street / Road / Area is required',
      fieldErrors: { street: ['Street / Road / Area is required'] },
    };
  }

  const houseNo = sanitizeText(data.houseNo || '', 120);
  const apartment = sanitizeText(data.apartment || '', 160);
  const landmark = sanitizeText(data.landmark || '', 160);
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = sanitizeText(data.firstName || parts[0] || '', 60);
  const lastName = sanitizeText(data.lastName || parts.slice(1).join(' ') || '', 60);
  const instructions = sanitizeText(data.deliveryInstructions || data.notes || '', 250);
  const packedNotes = packNotesAndAltPhone(data.notes || '', data.alternatePhone || '');
  const formatted = sanitizeText(
    data.formattedAddress ||
      [houseNo, apartment, streetVal, landmark ? `Near ${landmark}` : '', pinInfo.city, `${pinInfo.state} - ${zip}`]
        .filter(Boolean)
        .join(', '),
    300
  );

  return {
    record: {
      fullName,
      firstName,
      lastName,
      phone: normalizeIndianPhone(data.phone),
      email: sanitizeText(data.email || '', 180) || null,
      houseNo,
      apartment,
      street: streetVal,
      address: streetVal,
      addressLine1: streetVal,
      addressLine2: apartment,
      landmark,
      floor: sanitizeText(data.floor || '', 60) || null,
      city: sanitizeText(data.city || pinInfo.city, 80) || pinInfo.city,
      state: sanitizeText(data.state || pinInfo.state, 80) || pinInfo.state,
      pincode: zip,
      zipCode: zip,
      country: sanitizeText(data.country || 'India', 60) || 'India',
      type: data.type || 'home',
      deliveryOption: data.deliveryOption === 'gift' ? 'gift' : 'self',
      deliveryInstructions: instructions || null,
      deliverySpecialInstructions: instructions || null,
      notes: packedNotes || null,
      latitude: typeof data.latitude === 'number' ? data.latitude : null,
      longitude: typeof data.longitude === 'number' ? data.longitude : null,
      formattedAddress: formatted,
      receiverFirstName: sanitizeText(data.receiverFirstName || '', 60) || null,
      receiverLastName: sanitizeText(data.receiverLastName || '', 60) || null,
      receiverEmail: sanitizeText(data.receiverEmail || '', 180) || null,
      receiverPhone: data.receiverPhone ? normalizeIndianPhone(data.receiverPhone) : null,
      receiverAddress: sanitizeText(data.receiverAddress || '', 240) || null,
      receiverApartment: sanitizeText(data.receiverApartment || '', 160) || null,
      receiverCity: sanitizeText(data.receiverCity || '', 80) || null,
      receiverState: sanitizeText(data.receiverState || '', 80) || null,
      receiverZipCode: normalizePincode(data.receiverZipCode || '') || null,
    },
    wantDefault: Boolean(data.isDefault),
  };
};

// @desc    Get authenticated user's saved addresses
// @route   GET /api/users/addresses
// @access  Private
const getAddresses = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const addresses = await fetchUserAddresses(userId);
    return res.json({
      success: true,
      addresses,
      defaultAddress: addresses.find((a) => a.isDefault) || addresses[0] || null,
    });
  } catch (error) {
    console.error('Error fetching addresses:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to load saved addresses' });
  }
};

// @desc    Create a new saved address
// @route   POST /api/users/addresses
// @access  Private
const createAddress = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const validated = validateAndBuildAddressData(req.body);
    if (validated.error) {
      return res.status(400).json({
        success: false,
        message: validated.error,
        errors: validated.fieldErrors,
      });
    }

    const existingCount = await prisma.address.count({ where: { userId } });
    const shouldBeDefault = existingCount === 0 || validated.wantDefault;
    const newId = `addr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const created = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault && existingCount > 0) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: {
          id: newId,
          userId,
          ...validated.record,
          isDefault: shouldBeDefault,
        },
      });
    });

    const addresses = await fetchUserAddresses(userId);
    return res.status(201).json({
      success: true,
      message: 'Address saved successfully',
      address: serializeAddressRecord(created),
      addresses,
    });
  } catch (error) {
    console.error('Error creating address:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to save address' });
  }
};

// @desc    Update an existing saved address
// @route   PUT /api/users/addresses/:id
// @access  Private
const updateAddress = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const addressId = String(req.params.id);

    const existing = await prisma.address.findUnique({ where: { id: addressId } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const validated = validateAndBuildAddressData(req.body);
    if (validated.error) {
      return res.status(400).json({
        success: false,
        message: validated.error,
        errors: validated.fieldErrors,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (validated.wantDefault) {
        await tx.address.updateMany({
          where: { userId, id: { not: addressId }, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.update({
        where: { id: addressId },
        data: {
          ...validated.record,
          isDefault: validated.wantDefault ? true : existing.isDefault,
        },
      });
    });

    const addresses = await fetchUserAddresses(userId);
    return res.json({
      success: true,
      message: 'Address updated successfully',
      address: serializeAddressRecord(updated),
      addresses,
    });
  } catch (error) {
    console.error('Error updating address:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to update address' });
  }
};

// @desc    Delete a saved address
// @route   DELETE /api/users/addresses/:id
// @access  Private
const deleteAddress = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const addressId = String(req.params.id);

    const existing = await prisma.address.findUnique({ where: { id: addressId } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id: addressId } });

      if (existing.isDefault) {
        const nextAddress = await tx.address.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        });
        if (nextAddress) {
          await tx.address.update({
            where: { id: nextAddress.id },
            data: { isDefault: true },
          });
        }
      }
    });

    const addresses = await fetchUserAddresses(userId);
    return res.json({
      success: true,
      message: 'Address deleted successfully',
      addresses,
    });
  } catch (error) {
    console.error('Error deleting address:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
};

// @desc    Set a saved address as default
// @route   PATCH /api/users/addresses/:id/default
// @access  Private
const setDefaultAddress = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const addressId = String(req.params.id);

    const existing = await prisma.address.findUnique({ where: { id: addressId } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    await prisma.$transaction([
      prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      }),
    ]);

    const addresses = await fetchUserAddresses(userId);
    return res.json({
      success: true,
      message: 'Default delivery address updated',
      addresses,
      defaultAddress: addresses.find((a) => a.id === addressId) || null,
    });
  } catch (error) {
    console.error('Error setting default address:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to update default address' });
  }
};

module.exports = {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
