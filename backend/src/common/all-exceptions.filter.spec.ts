import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * The filter is the single exit point for errors, so it decides both the
 * status a caller sees and how much of our internals leak with it.
 */
describe('AllExceptionsFilter', () => {
  const cfg = (env: string): ConfigService =>
    ({ get: () => env }) as unknown as ConfigService;

  /** Captures what the filter would have sent. */
  function mockHost() {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'POST', url: '/api/thing' }),
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  }

  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('internal detail', {
      code,
      clientVersion: '6.19.3',
    });

  it('maps a unique violation (P2002) to 409, not 500', () => {
    const { host, status, json } = mockHost();
    new AllExceptionsFilter(cfg('production')).catch(prismaError('P2002'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json.mock.calls[0][0].statusCode).toBe(HttpStatus.CONFLICT);
  });

  it('maps a missing record (P2025) to 404', () => {
    const { host, status } = mockHost();
    new AllExceptionsFilter(cfg('production')).catch(prismaError('P2025'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('maps a foreign-key violation (P2003) to 400', () => {
    const { host, status } = mockHost();
    new AllExceptionsFilter(cfg('production')).catch(prismaError('P2003'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('never leaks Prisma internals for an unmapped code', () => {
    const { host, status, json } = mockHost();
    new AllExceptionsFilter(cfg('production')).catch(prismaError('P2016'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = JSON.stringify(json.mock.calls[0][0]);
    expect(body).not.toContain('internal detail');
    expect(body).not.toContain('P2016');
  });

  it('never leaks a stack trace or message from an unexpected error', () => {
    const { host, json } = mockHost();
    new AllExceptionsFilter(cfg('production')).catch(
      new Error('connection string postgres://user:pw@host/db'),
      host,
    );

    const body = JSON.stringify(json.mock.calls[0][0]);
    expect(body).not.toContain('postgres://');
    expect(body).not.toContain('connection string');
  });

  it('passes HttpExceptions through with their own status and message', () => {
    const { host, status, json } = mockHost();
    new AllExceptionsFilter(cfg('production')).catch(
      new ForbiddenException('Platform staff only'),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(JSON.stringify(json.mock.calls[0][0])).toContain(
      'Platform staff only',
    );
  });

  it('preserves validation error detail (the pipe decides what to include)', () => {
    const { host, status, json } = mockHost();
    new AllExceptionsFilter(cfg('development')).catch(
      new BadRequestException(['password must be shorter than 72 characters']),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(JSON.stringify(json.mock.calls[0][0])).toContain('password');
  });
});

describe('AllExceptionsFilter — Express-style errors', () => {
  const cfg = (env: string): ConfigService =>
    ({ get: () => env }) as unknown as ConfigService;

  function mockHost() {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'POST', url: '/api/auth/refresh' }),
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  }

  /** csrf-csrf throws this shape, not an HttpException. */
  it('maps a CSRF ForbiddenError to 403, not 500', () => {
    const err = Object.assign(new Error('invalid csrf token'), {
      statusCode: 403,
      code: 'EBADCSRFTOKEN',
    });
    const { host, status, json } = mockHost();
    new AllExceptionsFilter(cfg('production')).catch(err, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json.mock.calls[0][0].statusCode).toBe(403);
  });
});
