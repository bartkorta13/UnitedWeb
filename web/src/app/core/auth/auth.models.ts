export interface AdminUser {
  email: string;
  token: string;
  exp: number;
}

export interface CognitoAuthResponse {
  AuthenticationResult?: {
    AccessToken: string;
    IdToken: string;
    RefreshToken?: string;
    ExpiresIn: number;
    TokenType: string;
  };
  ChallengeName?: string;
  Session?: string;
  message?: string;
  __type?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
