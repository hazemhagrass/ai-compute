export class ConfigChangeError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ConfigChangeError";
    this.status = status;
  }
}
