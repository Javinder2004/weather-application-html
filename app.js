class WeatherApp {
    constructor() {
        this.currentLocation = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadCurrentLocation();
        this.updateCurrentDate();
    }

    bindEvents() {
        const searchBtn = document.getElementById('searchBtn');
        const cityInput = document.getElementById('cityInput');
        const locationBtn = document.getElementById('locationBtn');

        searchBtn.addEventListener('click', () => this.handleSearch());
        cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });
        locationBtn.addEventListener('click', () => this.getCurrentLocation());
    }

    updateCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
    }

    showLoading() {
        document.getElementById('loadingSpinner').classList.remove('hidden');
        document.getElementById('currentWeather').classList.add('hidden');
        document.getElementById('forecast').classList.add('hidden');
        document.getElementById('errorMessage').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loadingSpinner').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('errorText').textContent = message;
        document.getElementById('errorMessage').classList.remove('hidden');
        document.getElementById('currentWeather').classList.add('hidden');
        document.getElementById('forecast').classList.add('hidden');
        this.hideLoading();
    }

    showWeatherData() {
        document.getElementById('currentWeather').classList.remove('hidden');
        document.getElementById('forecast').classList.remove('hidden');
        document.getElementById('errorMessage').classList.add('hidden');
        this.hideLoading();
    }

    async handleSearch() {
        const cityInput = document.getElementById('cityInput');
        const cityName = cityInput.value.trim();
        
        if (!cityName) {
            this.showError('Please enter a city name');
            return;
        }

        this.showLoading();
        
        try {
            const coordinates = await this.geocodeCity(cityName);
            if (coordinates) {
                await this.fetchWeatherData(coordinates.lat, coordinates.lon, coordinates.name);
            } else {
                this.showError('City not found. Please check the spelling and try again.');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Unable to search for the city. Please try again.');
        }
    }

    async geocodeCity(cityName) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`
            );
            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = data[0];
                return {
                    lat: parseFloat(result.lat),
                    lon: parseFloat(result.lon),
                    name: result.display_name.split(',')[0] + ', ' + result.display_name.split(',').slice(-1)[0]
                };
            }
            return null;
        } catch (error) {
            console.error('Geocoding error:', error);
            return null;
        }
    }

    getCurrentLocation() {
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by this browser. Please search for a city instead.');
            return;
        }

        this.showLoading();

        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000 // 5 minutes
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    await this.fetchWeatherData(latitude, longitude);
                } catch (error) {
                    console.error('Error processing location:', error);
                    this.showError('Error getting weather for your location. Please try searching for a city.');
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                let errorMessage = 'Unable to get your location. ';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Location access was denied. Please search for a city instead.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Location information is unavailable. Please search for a city instead.';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Location request timed out. Please search for a city instead.';
                        break;
                    default:
                        errorMessage += 'Please search for a city instead.';
                        break;
                }
                
                this.showError(errorMessage);
            },
            options
        );
    }

    loadCurrentLocation() {
        this.showLoading();
        
        // Check if geolocation is available and try to get current location
        if (navigator.geolocation) {
            const options = {
                enableHighAccuracy: false,
                timeout: 8000,
                maximumAge: 300000 // 5 minutes
            };

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const { latitude, longitude } = position.coords;
                        await this.fetchWeatherData(latitude, longitude);
                    } catch (error) {
                        console.error('Error with current location:', error);
                        // Fallback to default location
                        await this.fetchWeatherData(40.7128, -74.0060, 'New York, NY');
                    }
                },
                async (error) => {
                    console.log('Geolocation not available or denied, using default location');
                    // Fallback to default location without showing error
                    await this.fetchWeatherData(40.7128, -74.0060, 'New York, NY');
                },
                options
            );
        } else {
            // Fallback to default location
            this.fetchWeatherData(40.7128, -74.0060, 'New York, NY');
        }
    }

    async fetchWeatherData(lat, lon, locationName = null) {
        try {
            // Fetch current weather and forecast
            const weatherResponse = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,pressure_msl,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`
            );

            if (!weatherResponse.ok) {
                throw new Error(`Weather API request failed: ${weatherResponse.status}`);
            }

            const weatherData = await weatherResponse.json();

            // If no location name provided, reverse geocode
            if (!locationName) {
                locationName = await this.reverseGeocode(lat, lon);
            }

            this.updateWeatherDisplay(weatherData, locationName);
            this.showWeatherData();

        } catch (error) {
            console.error('Weather fetch error:', error);
            this.showError('Unable to fetch weather data. Please check your internet connection and try again.');
        }
    }

    async reverseGeocode(lat, lon) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`
            );
            
            if (!response.ok) {
                throw new Error('Reverse geocoding failed');
            }
            
            const data = await response.json();
            
            if (data && data.display_name) {
                const parts = data.display_name.split(',');
                const city = parts[0] || 'Unknown City';
                const country = parts[parts.length - 1] || 'Unknown Country';
                return `${city.trim()}, ${country.trim()}`;
            }
            return 'Current Location';
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return 'Current Location';
        }
    }

    updateWeatherDisplay(data, locationName) {
        const current = data.current;
        const daily = data.daily;

        // Update location
        document.getElementById('locationName').textContent = locationName;

        // Update current weather
        document.getElementById('currentTemp').textContent = Math.round(current.temperature_2m);
        document.getElementById('feelsLike').textContent = Math.round(current.apparent_temperature);
        document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
        document.getElementById('windSpeed').textContent = `${Math.round(current.wind_speed_10m)} km/h`;
        document.getElementById('pressure').textContent = `${Math.round(current.pressure_msl)} hPa`;
        document.getElementById('uvIndex').textContent = current.uv_index ? Math.round(current.uv_index) : 'N/A';

        // Update weather description and icon
        const weatherInfo = this.getWeatherInfo(current.weather_code);
        document.getElementById('weatherDescription').textContent = weatherInfo.description;
        document.getElementById('currentIcon').src = weatherInfo.icon;
        document.getElementById('currentIcon').alt = weatherInfo.description;

        // Update 7-day forecast
        this.updateForecast(daily);
    }

    updateForecast(daily) {
        const forecastContainer = document.getElementById('forecastContainer');
        forecastContainer.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const forecastCard = this.createForecastCard(
                daily.time[i],
                daily.weather_code[i],
                daily.temperature_2m_max[i],
                daily.temperature_2m_min[i],
                i === 0
            );
            forecastContainer.appendChild(forecastCard);
        }
    }

    createForecastCard(date, weatherCode, maxTemp, minTemp, isToday) {
        const card = document.createElement('div');
        card.className = 'forecast-card fade-in';

        const dayName = isToday ? 'Today' : new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
        const weatherInfo = this.getWeatherInfo(weatherCode);

        card.innerHTML = `
            <div class="forecast-card__day">${dayName}</div>
            <div class="forecast-card__icon">
                <img src="${weatherInfo.icon}" alt="${weatherInfo.description}" width="50" height="50">
            </div>
            <div class="forecast-card__temps">
                <span class="forecast-card__high">${Math.round(maxTemp)}°</span>
                <span class="forecast-card__low">${Math.round(minTemp)}°</span>
            </div>
            <div class="forecast-card__condition">${weatherInfo.description}</div>
        `;

        return card;
    }

    getWeatherInfo(weatherCode) {
        // WMO Weather interpretation codes mapping
        const weatherCodes = {
            0: { description: 'Clear sky', icon: 'https://openweathermap.org/img/wn/01d@2x.png' },
            1: { description: 'Mainly clear', icon: 'https://openweathermap.org/img/wn/01d@2x.png' },
            2: { description: 'Partly cloudy', icon: 'https://openweathermap.org/img/wn/02d@2x.png' },
            3: { description: 'Overcast', icon: 'https://openweathermap.org/img/wn/03d@2x.png' },
            45: { description: 'Fog', icon: 'https://openweathermap.org/img/wn/50d@2x.png' },
            48: { description: 'Depositing rime fog', icon: 'https://openweathermap.org/img/wn/50d@2x.png' },
            51: { description: 'Light drizzle', icon: 'https://openweathermap.org/img/wn/09d@2x.png' },
            53: { description: 'Moderate drizzle', icon: 'https://openweathermap.org/img/wn/09d@2x.png' },
            55: { description: 'Dense drizzle', icon: 'https://openweathermap.org/img/wn/09d@2x.png' },
            56: { description: 'Light freezing drizzle', icon: 'https://openweathermap.org/img/wn/09d@2x.png' },
            57: { description: 'Dense freezing drizzle', icon: 'https://openweathermap.org/img/wn/09d@2x.png' },
            61: { description: 'Slight rain', icon: 'https://openweathermap.org/img/wn/10d@2x.png' },
            63: { description: 'Moderate rain', icon: 'https://openweathermap.org/img/wn/10d@2x.png' },
            65: { description: 'Heavy rain', icon: 'https://openweathermap.org/img/wn/10d@2x.png' },
            66: { description: 'Light freezing rain', icon: 'https://openweathermap.org/img/wn/10d@2x.png' },
            67: { description: 'Heavy freezing rain', icon: 'https://openweathermap.org/img/wn/10d@2x.png' },
            71: { description: 'Slight snow fall', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            73: { description: 'Moderate snow fall', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            75: { description: 'Heavy snow fall', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            77: { description: 'Snow grains', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            80: { description: 'Slight rain showers', icon: 'https://openweathermap.org/img/wn/09d@2x.png' },
            81: { description: 'Moderate rain showers', icon: 'https://openweathermap.org/img/wn/09d@2x.png' },
            82: { description: 'Violent rain showers', icon: 'https://openweathermap.org/img/wn/09d@2x.png' },
            85: { description: 'Slight snow showers', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            86: { description: 'Heavy snow showers', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            95: { description: 'Thunderstorm', icon: 'https://openweathermap.org/img/wn/11d@2x.png' },  
            96: { description: 'Thunderstorm with slight hail', icon: 'https://openweathermap.org/img/wn/11d@2x.png' },
            99: { description: 'Thunderstorm with heavy hail', icon: 'https://openweathermap.org/img/wn/11d@2x.png' }
        };

        return weatherCodes[weatherCode] || { 
            description: 'Unknown', 
            icon: 'https://openweathermap.org/img/wn/01d@2x.png' 
        };
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});