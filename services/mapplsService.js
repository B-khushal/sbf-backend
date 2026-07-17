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
    params.append('tokenizeAddress', 'true');

    // Use search/json endpoint which is OAuth compatible
    const response = await fetch(`https://atlas.mapmyindia.com/api/places/search/json?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://sbflorist.in',
        'Referer': 'https://sbflorist.in/'
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
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://sbflorist.in',
        'Referer': 'https://sbflorist.in/'
      }
    });

    if (!response.ok) {
      throw new Error(`Place Details request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check if coordinates are in flat response or nested in result
    const lat = data.latitude || (data.result && data.result.latitude);
    const lng = data.longitude || (data.result && data.result.longitude);

    if (lat === 'RESTRICTED' || lng === 'RESTRICTED') {
      throw new Error('Coordinates access restricted under your Mappls plan. Please whitelist your VPS IP or contact Mappls support.');
    }

    if (lat && lng) {
      return {
        latitude: Number(lat),
        longitude: Number(lng)
      };
    }
    throw new Error('No coordinates returned for this eLoc. Plan might be restricted.');
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
    const apiKey = process.env.MAPPLS_API_KEY || process.env.VITE_MAPPLS_API_KEY || 'ec2ae7ed0bbcca3fcb6b405be70ac679';
    
    console.log(`🔄 Reverse geocoding coords: Lat: ${lat}, Lng: ${lng}`);

    // Primary: Try legacy advancedmaps API using whitelisted static key
    try {
      const url = `https://apis.mapmyindia.com/advancedmaps/v1/${apiKey}/rev_geocode?lat=${lat}&lng=${lng}`;
      const response = await fetch(url, {
        headers: {
          'Origin': 'https://sbflorist.in',
          'Referer': 'https://sbflorist.in/'
        }
      });

      if (response.ok) {
        const addressData = await response.json();
        const result = addressData.results && addressData.results[0];
        if (result) {
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
        }
      } else {
        console.warn(`⚠️ Primary MapmyIndia rev_geocode returned status ${response.status}. Attempting OAuth fallback...`);
      }
    } catch (primaryErr) {
      console.warn('⚠️ Primary static-key rev-geocode failed, trying OAuth fallback...', primaryErr.message);
    }

    // Fallback: Use OAuth 2.0 reverse geocoding endpoint
    const token = await getAccessToken();
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng)
    });

    const fallbackResponse = await fetch(`https://search.mappls.com/search/address/rev-geocode?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://sbflorist.in',
        'Referer': 'https://sbflorist.in/'
      }
    });

    if (!fallbackResponse.ok) {
      throw new Error(`Reverse geocoding request failed: ${fallbackResponse.statusText}`);
    }

    const addressData = await fallbackResponse.json();
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
