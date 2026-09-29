export type GlobalUser = {
  id: string;
  email: string;
  role: "PASSENGER" | "DRIVER" | "ADMIN";
};

declare global {
  namespace Express {
    interface Request {
      user?: GlobalUser;
      requestId?: string;
    }
  }
}

export {};
