import axios from 'axios';

class LocationAutocompleteService {
  constructor() {
    this.baseURL = 'https://nominatim.openstreetmap.org';
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000;
  }

  async searchLocations(query, userLocation = null) {
    try {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
        );
      }
      this.lastRequestTime = Date.now();

      const params = {
        q: query,
        format: 'json',
        addressdetails: 1,
        limit: 20,
        countrycodes: 'it',
        'accept-language': 'it',
      };

      const response = await axios.get(`${this.baseURL}/search`, {
        params,
        headers: {
          'User-Agent': 'TravelCompanionApp/1.0'
        },
        timeout: 10000,
      });

      return response.data
        .filter(item => {
          const validTypes = ['city', 'town', 'village', 'municipality'];
          return validTypes.includes(item.addresstype);
        })
        .map(item => ({
          id: item.place_id,
          name: this.formatLocationName(item),
          fullAddress: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
        }))
        .slice(0, 5);
    } catch (error) {
      return [];
    }
  }

  formatLocationName(item) {
    const address = item.address;
    const parts = [];
    const mainName = address.city || address.town || address.village || address.municipality;
    if (mainName) parts.push(mainName);
    if (address.state && address.state !== mainName) parts.push(address.state);
    if (address.country) parts.push(address.country);
    return parts.length > 0 ? parts.join(', ') : item.display_name;
  }
}

export default new LocationAutocompleteService();