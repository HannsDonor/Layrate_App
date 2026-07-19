import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/constants/config';
import { setWidgetLoggedOut } from '@/utils/widget';

const TOKEN_KEY = '@layrate_auth_token';
const USER_KEY = '@layrate_user';

export type User = {
  id: number;
  email: string;
  name?: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (response.status === 401) {
    throw new Error('Invalid email or password');
  }

  if (!response.ok) {
    throw new Error(data.message || 'Login failed');
  }

  await setSession(data.token, data.user);

  return data;
}

export async function setSession(token: string, user: User): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getUser(): Promise<User | null> {
  const userJson = await AsyncStorage.getItem(USER_KEY);
  return userJson ? JSON.parse(userJson) : null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

export async function logout(): Promise<void> {
  await clearSession();
  setWidgetLoggedOut();
}

export async function fetchWithAuth(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();

  const headers = {
    ...(init.headers || {}),
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  return fetch(`${API_BASE_URL}${input}`, {
    ...init,
    headers,
  });
}
