import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import { useCallback, useMemo } from 'react';

// Default API URL fallback for development
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/dashboard/v1';

export function useApi() {
  const { getToken } = useAuth();
  
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_URL,
    });

    instance.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return instance;
  }, [getToken]);

  return api;
}
