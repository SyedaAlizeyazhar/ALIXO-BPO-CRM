/* An error caused by the request (bad input, missing record) rather than the server. */
export class HttpError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
