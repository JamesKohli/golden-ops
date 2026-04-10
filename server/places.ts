/**
 * Google Places API (New) helper — looks up a business and returns website + phone.
 */

interface PlaceDetails {
  website_url: string | null;
  google_phone: string | null;
  google_place_id: string | null;
}

export async function lookupPlace(
  businessName: string,
  address: string,
  apiKey: string
): Promise<PlaceDetails> {
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.websiteUri,places.internationalPhoneNumber',
      },
      body: JSON.stringify({ textQuery: `${businessName} ${address}` }),
    });

    const data = await res.json();

    if (data.error) {
      console.error(`Places API error for "${businessName}":`, data.error.message);
      return { website_url: null, google_phone: null, google_place_id: null };
    }

    const place = data.places?.[0];
    if (!place) {
      return { website_url: null, google_phone: null, google_place_id: null };
    }

    return {
      website_url: place.websiteUri || null,
      google_phone: place.internationalPhoneNumber || null,
      google_place_id: place.id || null,
    };
  } catch (e) {
    console.error(`Places API lookup failed for "${businessName}":`, e);
    return { website_url: null, google_phone: null, google_place_id: null };
  }
}
