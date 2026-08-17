import { request } from "@/lib/api-client";
import type { CurrentUserDto, LoginResponse, SsoProvidersDto } from "@/types/api";

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getSsoProviders(): Promise<SsoProvidersDto> {
  return request<SsoProvidersDto>("/auth/sso/providers");
}

export async function completeSso(code: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/sso/exchange", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export async function me(): Promise<CurrentUserDto> {
  return request<CurrentUserDto>("/auth/me");
}

export async function forgotPassword(email: string): Promise<void> {
  return request<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  email: string,
  token: string,
  newPassword: string,
): Promise<void> {
  return request<void>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, token, newPassword }),
  });
}
