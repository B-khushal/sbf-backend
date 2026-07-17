let cachedToken = null;
let tokenExpiry = null;

/**
 * Generate a Mappls OAuth 2.0 access token using client credentials.
 * Caches the token in memory to avoid token generation on every request.
 */
async function getAccessToken() {
  const clientId = process.env.MAPPLS_CLIENT_ID;
  const clientSecret = process.env.MAPPLS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Mappls Client ID or Client Secret not found in environment variables!');
    throw new Error('Mappls credentials not configured on server. Please check your .env file.');
  }

  // Check if we have a valid cached token (with 1-minute safety buffer)
  if (cachedToken && tokenExpiry && Date.now() < (tokenExpiry - 60000)) {
    return cachedToken;
  }

  console.log('🔄 Fetching a new Mappls OAuth access token...');
  try {
    const response = await fetch('https://outpost.mappls.com/api/security/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Mappls OAuth Token generation failed:', errorText);
      throw new Error(`Mappls token server returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    // expires_in is in seconds, convert to absolute milliseconds
    tokenExpiry = Date.now() + (data.expires_in * 1000);

    console.log(`✅ Mappls access token acquired successfully. Expires in ${data.expires_in} seconds.`);
    return cachedToken;
  } catch (error) {
    console.error('❌ Mappls OAuth service call failed:', error);
    throw error;
  }
}

/**
 * Mappls Autosuggest (Autocomplete) API
 */
async function autosuggest(query, location) {
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({ query });
    if (location) {
      params.append('location', location);
    }
    // Set tokenizeAddress to true for clean address structures if needed
    params.append('tokenizeAddress', 'true');

    const response = await fetch(`https://atlas.mappls.com/api/places/autosuggest?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Autosuggest request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.suggestedLocations || [];
  } catch (error) {
    console.error('❌ Error in Mappls autosuggest service:', error);
    throw error;
  }
}

/**
 * Mappls Place Details (O2O Entity) API to resolve coordinates from eLoc
 */
async function getPlaceDetails(eLoc) {
  try {
    const token = await getAccessToken();
    const response = await fetch(`https://explore.mappls.com/apis/O2O/entity/${eLoc}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Place Details request failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data && data.result) {
      return {
        latitude: Number(data.result.latitude),
        longitude: Number(data.result.longitude)
      };
    }
    throw new Error('No place details returned for this eLoc');
  } catch (error) {
    console.error('❌ Error in Mappls getPlaceDetails service:', error);
    throw error;
  }
}

/**
 * Mappls Reverse Geocoding API with fallback
 */
async function reverseGeocode(lat, lng) {
  try {
    const token = await getAccessToken();

    // Primary endpoint: search.mappls.com
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng) // parameter is 'lon'
    });

    console.log(`🔄 Reverse geocoding coords: Lat: ${lat}, Lng: ${lng}`);
    const response = await fetch(`https://search.mappls.com/search/address/rev-geocode?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    let addressData;
    if (response.ok) {
      addressData = await response.json();
    } else {
      console.warn(`⚠️ Primary Mappls rev-geocode returned status ${response.status}. Attempting fallback...`);
      // Fallback endpoint: apis.mappls.com/advancedmaps/v1/reverse
      const fallbackResponse = await fetch(`https://apis.mappls.com/advancedmaps/v1/reverse?lat=${lat}&lng=${lng}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!fallbackResponse.ok) {
        throw new Error(`Both primary and fallback reverse geocoding endpoints failed.`);
      }
      addressData = await fallbackResponse.json();
    }

    const result = addressData.results && addressData.results[0];
    if (!result) {
      throw new Error('Reverse geocode successful but returned empty results list.');
    }

    return {
      formattedAddress: result.formatted_address || '',
      city: result.city || '',
      state: result.state || '',
      pincode: result.pincode || '',
      country: result.country || 'India',
      landmark: result.poi || result.sublocality || '',
      houseNo: result.house_number || '',
      apartment: result.house_name || '',
      street: result.street || ''
    };
  } catch (error) {
    console.error('❌ Error in Mappls reverseGeocode service:', error);
    throw error;
  }
}

module.exports = {
  autosuggest,
  getPlaceDetails,
  reverseGeocode
};
