// Throw from anywhere in a request (route, service) to end it with a specific
// HTTP status and a client-safe message. `withRoute` turns it into
// `{ error: message }` with that status instead of a logged 500.
export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export class AuthError extends HttpError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "AuthError";
  }
}
