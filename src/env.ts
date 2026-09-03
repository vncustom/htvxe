export type Bindings = {
  DATABASE_URL: string;
  AUTH_SECRET: string;
  APP_TZ?: string;
  ASSETS: Fetcher;
  HTV_SSO_SERVER_URL?: string;
  HTV_SSO_SECRET?: string;
};

export type Session = {
  username: string;
  fullName: string;
  role: string;
  isDriver: boolean;
  dsBan: string | null;
};

export type Variables = {
  session: Session | null;
  db: import("./db/client").DB;
  sql: import("postgres").Sql;
};

export type Env = { Bindings: Bindings; Variables: Variables };
