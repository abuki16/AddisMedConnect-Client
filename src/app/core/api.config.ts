import { environment } from '../../environments/environment';

/**
 * Base API URL endpoint resolved from the active environment configuration.
 */
export const apiUrl: string = environment.apiUrl || '/api';

/**
 * Base SignalR Hubs URL endpoint resolved from the active environment configuration.
 */
export const hubUrl: string = environment.hubUrl || '/hubs';

