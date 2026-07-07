const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:5000/api'
    : 'https://fantasy-vafy.onrender.com/api');

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

export function getUser() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

export function setUser(user) {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

const getCache = {};

export async function request(endpoint, options = {}) {
  const method = options.method || 'GET';
  
  // Cache GET requests for 15 seconds
  if (method === 'GET') {
    const cacheKey = endpoint;
    const cached = getCache[cacheKey];
    const now = Date.now();
    
    if (cached && (now - cached.timestamp < 15000)) {
      return cached.data;
    }
  }

  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  // Save to cache for GET requests
  if (method === 'GET') {
    getCache[endpoint] = {
      data,
      timestamp: Date.now()
    };
  } else {
    // Clear cache on mutations (POST, PUT, DELETE) to prevent stale data
    for (const key in getCache) {
      delete getCache[key];
    }
  }

  return data;
}
