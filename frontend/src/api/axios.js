// src/api/axios.js
import axios from 'axios';
import { auth } from '../config/firebase';

const API = axios.create({
  baseURL: 'http://localhost:4000/api',
});

// attach firebase token to every request automatically
API.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    const devToken = localStorage.getItem('gg_dev_token');
    if (devToken) config.headers.Authorization = `Bearer ${devToken}`;
  }
  return config;
});

export default API;
