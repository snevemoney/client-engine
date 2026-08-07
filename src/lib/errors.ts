/**
 * Standardized application error classes.
 * Use these instead of raw Error for typed status-bearing exceptions.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500
  ) {
    super(message)
    this.name = 'AppError'
    // Restore prototype chain (required for instanceof checks in transpiled code)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403)
    this.name = 'ForbiddenError'
  }
}

/** Type-narrow to check if an unknown error is an AppError. */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}
