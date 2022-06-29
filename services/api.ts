import axios, { AxiosError } from 'axios';
import { GetServerSidePropsContext } from 'next';
import { parseCookies, setCookie } from 'nookies';
import { signOut } from '../context/AuthContext';
import { AuthTokenError } from './errors/AuthTokenError';

interface AxiosErrorResponse {
  code?: string;
}

type FailedRequest = {
  onSuccess: (token: string) => void;
  onFailure: (error: AxiosError) => void;
};

type Context = undefined | GetServerSidePropsContext;

let isRefreshing = false;
let failedRequestsQueue = Array<FailedRequest>();

export function setupAPIClient(ctx: Context = undefined) {
  let cookies = parseCookies(ctx);

  const api = axios.create({
    baseURL: 'http://localhost:3333',
  });

  api.defaults.headers.common[
    'Authorization'
  ] = `Bearer ${cookies['nextAuth.token']}`;

  api.interceptors.response.use(
    (response) => {
      return response;
    },
    (error: AxiosError<AxiosErrorResponse>) => {
      if (error.response?.status === 401) {
        if (error.response.data?.code === 'token.expired') {
          cookies = parseCookies(ctx);

          const { 'nextAuth.refreshToken': refreshToken } = cookies;
          const originalConfig = error.config;
          if (!isRefreshing) {
            isRefreshing = true;
            api
              .post('/refresh', { refreshToken })
              .then((response) => {
                const { token } = response.data;

                setCookie(ctx, 'nextAuth.token', token, {
                  maxAge: 60 * 60 * 24 * 30, // 30 days
                  path: '/',
                });
                setCookie(
                  ctx,
                  'nextAuth.refreshToken',
                  response.data.refreshToken,
                  {
                    maxAge: 60 * 60 * 24 * 30, // 30 days
                    path: '/',
                  }
                );

                api.defaults.headers.common[
                  'Authorization'
                ] = `Bearer ${token}`;

                failedRequestsQueue.forEach((request) => {
                  request.onSuccess(token);
                });
                failedRequestsQueue = [];
              })
              .catch((error) => {
                failedRequestsQueue.forEach((request) => {
                  request.onFailure(error);
                });
                failedRequestsQueue = [];

                if (typeof window !== 'undefined') {
                  signOut();
                }
              })
              .finally(() => {
                isRefreshing = false;
              });
          }

          return new Promise((resolve, reject) => {
            failedRequestsQueue.push({
              onSuccess: (token: string) => {
                if (!originalConfig?.headers) {
                  return;
                }
                originalConfig.headers['Authorization'] = `Bearer ${token}`;
                resolve(api(originalConfig));
              },
              onFailure: (error: AxiosError) => {
                reject(error);
              },
            });
          });
        } else {
          if (typeof window !== 'undefined') {
            console.log(typeof window !== undefined);
            signOut();
          } else {
            return Promise.reject(new AuthTokenError());
          }
        }
      }

      return Promise.reject(error);
    }
  );

  return api;
}
