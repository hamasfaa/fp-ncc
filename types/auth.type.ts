export interface UserCredentials {
  email: string;
  password: string;
}

export interface UserRegistration extends UserCredentials {
  username: string;
}

export interface AuthResponse {
  user: User | null;
  token: string | null;
  error?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  status?: string;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}
