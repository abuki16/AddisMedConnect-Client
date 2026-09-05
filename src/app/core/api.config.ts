import { environment } from '../../environments/environment';

function resolveApiUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.port === '4200') {
      return 'http://localhost:5057/api';
    }
    return `${window.location.origin}/api`;
  }
  return environment.apiUrl || 'http://localhost:5057/api';
}

function resolveHubUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.port === '4200') {
      return 'http://localhost:5057/hubs';
    }
    return `${window.location.origin}/hubs`;
  }
  return environment.hubUrl || 'http://localhost:5057/hubs';
}

export const apiUrl = resolveApiUrl();
export const hubUrl = resolveHubUrl();
