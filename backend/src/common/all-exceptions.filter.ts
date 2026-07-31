import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Single exit point for every error.
 *
 * Two jobs:
 *  1. Map Prisma errors to the status they actually mean. Without this a unique
 *     violation (P2002) — which the gateway idempotency index relies on — comes
 *     back as an opaque 500, so callers can't tell "already done" from "broken".
 *  2. Keep internals out of client responses. Prisma error messages embed model
 *     and field names, and stack traces embed paths; both go to the log, never
 *     the wire.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');
  private readonly isProd: boolean;

  constructor(config: ConfigService) {
    this.isProd = config.get<string>('env') === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, body, logLevel } = this.translate(exception);

    // Log server-side with full detail regardless of what the client sees.
    const detail =
      exception instanceof Error ? exception.stack : String(exception);
    const line = `${req.method} ${req.url} -> ${status}`;
    if (logLevel === 'error') this.logger.error(line, detail);
    else this.logger.warn(`${line}: ${this.summarize(exception)}`);

    res.status(status).json(body);
  }

  private translate(exception: unknown): {
    status: number;
    body: Record<string, unknown>;
    logLevel: 'warn' | 'error';
  } {
    // Already an intentional HTTP error — pass through untouched. Nest's
    // ValidationPipe errors land here too.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      return {
        status,
        body:
          typeof response === 'string'
            ? { statusCode: status, message: response }
            : (response as Record<string, unknown>),
        // 5xx from our own code is a real fault; 4xx is expected traffic.
        logLevel: status >= 500 ? 'error' : 'warn',
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.translatePrisma(exception);
    }

    // csrf-csrf throws a plain Error subclass carrying an Express-style
    // `statusCode`, not an HttpException — without this a rejected CSRF token
    // surfaces as a 500 instead of a 403.
    const code = (exception as { statusCode?: unknown })?.statusCode;
    if (typeof code === 'number' && code >= 400 && code < 600) {
      return {
        status: code,
        body: {
          statusCode: code,
          error: code === HttpStatus.FORBIDDEN ? 'Forbidden' : 'Error',
          message:
            exception instanceof Error && code < 500
              ? exception.message
              : 'Something went wrong.',
        },
        logLevel: code >= 500 ? 'error' : 'warn',
      };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      // Bad query shape — our bug, not the caller's.
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: this.generic(HttpStatus.INTERNAL_SERVER_ERROR),
        logLevel: 'error',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: this.generic(HttpStatus.INTERNAL_SERVER_ERROR),
      logLevel: 'error',
    };
  }

  private translatePrisma(e: Prisma.PrismaClientKnownRequestError): {
    status: number;
    body: Record<string, unknown>;
    logLevel: 'warn' | 'error';
  } {
    switch (e.code) {
      // Unique constraint violation. Callers rely on this for idempotency
      // (e.g. a replayed gateway token), so it must be distinguishable.
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          body: {
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            message: 'That record already exists.',
          },
          logLevel: 'warn',
        };
      // Record not found for update/delete.
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: {
            statusCode: HttpStatus.NOT_FOUND,
            error: 'Not Found',
            message: 'Record not found.',
          },
          logLevel: 'warn',
        };
      // Foreign key / required relation violation — caller referenced
      // something that doesn't exist.
      case 'P2003':
      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'Bad Request',
            message: 'Referenced record is missing or invalid.',
          },
          logLevel: 'warn',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          body: this.generic(HttpStatus.INTERNAL_SERVER_ERROR),
          logLevel: 'error',
        };
    }
  }

  /** Client-safe 500 body — no message, no stack, no model names. */
  private generic(status: number): Record<string, unknown> {
    return {
      statusCode: status,
      error: 'Internal Server Error',
      message: 'Something went wrong.',
    };
  }

  /** Short server-log summary. Never sent to the client. */
  private summarize(exception: unknown): string {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return `Prisma ${exception.code}`;
    }
    if (exception instanceof HttpException) {
      return exception.message;
    }
    return this.isProd ? 'unknown error' : String(exception);
  }
}
