class WeatherApp {
    constructor() {
        this.currentLocation = null;
        this.isFahrenheit = false; // ✅ Track unit preference
        this.lastWeatherData = null;
        this.lastLocationName = null;
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
        const toggleBtn = document.getElementById('unitToggle');

        searchBtn.addEventListener('click', () => this.handleSearch());
        cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });
        locationBtn.addEventListener('click', () => this.getCurrentLocation());

        // ✅ Toggle temperature unit
        toggleBtn.addEventListener('click', () => this.toggleTemperatureUnit());
    }

    toggleTemperatureUnit() {
        this.isFahrenheit = !this.isFahrenheit;

        document.getElementById('unitToggle').textContent =
            this.isFahrenheit ? "Switch to °C" : "Switch to °F";

        if (this.lastWeatherData && this.lastLocationName) {
            this.updateWeatherDisplay(this.lastWeatherData, this.lastLocationName);
        }
    }

    convertToFahrenheit(celsius) {
        return (celsius * 9 / 5) + 32;
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
            this.showError('Geolocation is not supported by this browser.');
            return;
        }

        this.showLoading();

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    await this.fetchWeatherData(latitude, longitude);
                } catch (error) {
                    this.showError('Error getting weather. Try searching for a city.');
                }
            },
            async () => {
                await this.fetchWeatherData(40.7128, -74.0060, 'New York, NY');
            }
        );
    }

    loadCurrentLocation() {
        this.showLoading();

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    await this.fetchWeatherData(latitude, longitude);
                },
                async () => {
                    await this.fetchWeatherData(40.7128, -74.0060, 'New York, NY');
                }
            );
        } else {
            this.fetchWeatherData(40.7128, -74.0060, 'New York, NY');
        }
    }

    async fetchWeatherData(lat, lon, locationName = null) {
        try {
            const weatherResponse = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,pressure_msl,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`
            );

            const weatherData = await weatherResponse.json();

            if (!locationName) {
                locationName = await this.reverseGeocode(lat, lon);
            }

            // ✅ Save last data for toggling
            this.lastWeatherData = weatherData;
            this.lastLocationName = locationName;

            this.updateWeatherDisplay(weatherData, locationName);
            this.showWeatherData();

        } catch (error) {
            this.showError('Unable to fetch weather data.');
        }
    }

    async reverseGeocode(lat, lon) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`
            );

            const data = await response.json();

            if (data && data.display_name) {
                const parts = data.display_name.split(',');
                const city = parts[0] || 'Unknown City';
                const country = parts[parts.length - 1] || 'Unknown Country';
                return `${city.trim()}, ${country.trim()}`;
            }
            return 'Current Location';
        } catch {
            return 'Current Location';
        }
    }

    updateWeatherDisplay(data, locationName) {
        const current = data.current;
        const daily = data.daily;

        document.getElementById('locationName').textContent = locationName;

        const currentTempC = current.temperature_2m;
        const currentTempF = this.convertToFahrenheit(currentTempC);

        const feelsLikeC = current.apparent_temperature;
        const feelsLikeF = this.convertToFahrenheit(feelsLikeC);

        // ✅ Show selected unit only
        const displayTemp = this.isFahrenheit ? Math.round(currentTempF) + "°F" : Math.round(currentTempC) + "°C";
        const displayFeels = this.isFahrenheit ? Math.round(feelsLikeF) + "°F" : Math.round(feelsLikeC) + "°C";

        document.getElementById('currentTemp').textContent = displayTemp;
        document.getElementById('feelsLike').textContent = displayFeels;

        document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
        document.getElementById('windSpeed').textContent = `${Math.round(current.wind_speed_10m)} km/h`;
        document.getElementById('pressure').textContent = `${Math.round(current.pressure_msl)} hPa`;
        document.getElementById('uvIndex').textContent = current.uv_index ? Math.round(current.uv_index) : 'N/A';

        const weatherInfo = this.getWeatherInfo(current.weather_code);
        document.getElementById('weatherDescription').textContent = weatherInfo.description;
        document.getElementById('currentIcon').src = weatherInfo.icon;

        this.updateForecast(daily);
    }

    updateForecast(daily) {
        const forecastContainer = document.getElementById('forecastContainer');
        forecastContainer.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const card = this.createForecastCard(
                daily.time[i],
                daily.weather_code[i],
                daily.temperature_2m_max[i],
                daily.temperature_2m_min[i],
                i === 0
            );
            forecastContainer.appendChild(card);
        }
    }

    createForecastCard(date, weatherCode, maxTemp, minTemp, isToday) {
        const card = document.createElement('div');
        card.className = 'forecast-card fade-in';

        const dayName = isToday ? 'Today' : new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
        const weatherInfo = this.getWeatherInfo(weatherCode);

        const maxTempC = Math.round(maxTemp);
        const minTempC = Math.round(minTemp);
        const maxTempF = Math.round(this.convertToFahrenheit(maxTemp));
        const minTempF = Math.round(this.convertToFahrenheit(minTemp));

        // ✅ Switch units
        const high = this.isFahrenheit ? maxTempF + "°F" : maxTempC + "°C";
        const low = this.isFahrenheit ? minTempF + "°F" : minTempC + "°C";

        card.innerHTML = `
            <div class="forecast-card__day">${dayName}</div>
            <div class="forecast-card__icon">
                <img src="${weatherInfo.icon}" alt="${weatherInfo.description}" width="50" height="50">
            </div>
            <div class="forecast-card__temps">
                <span class="forecast-card__high">${high}</span>
                <span class="forecast-card__low">${low}</span>
            </div>
            <div class="forecast-card__condition">${weatherInfo.description}</div>
        `;

        return card;
    }

    getWeatherInfo(weatherCode) {
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
            71: { description: 'Slight snow', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            73: { description: 'Moderate snow', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            75: { description: 'Heavy snow', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            77: { description: 'Snow grains', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            80: { description: 'Light rain showers', icon: 'https://openweathermap.org/img/wn/09d@2x.png' },
            81: { description: 'Moderate rain showers', icon: 'https://openweathermap.org/img/wn/09d@2x.png' },
            82: { description: 'Violent rain showers', icon: 'https://openweathermap.org/img/wn/09d@2x.png' },
            85: { description: 'Light snow showers', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            86: { description: 'Heavy snow showers', icon: 'https://openweathermap.org/img/wn/13d@2x.png' },
            95: { description: 'Thunderstorm', icon: 'https://openweathermap.org/img/wn/11d@2x.png' },
            96: { description: 'Thunderstorm with hail', icon: 'https://openweathermap.org/img/wn/11d@2x.png' },
            99: { description: 'Thunderstorm with heavy hail', icon: 'https://openweathermap.org/img/wn/11d@2x.png' }
        };

        return weatherCodes[weatherCode] || { 
            description: 'Unknown', 
            icon: 'https://openweathermap.org/img/wn/01d@2x.png' 
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});
