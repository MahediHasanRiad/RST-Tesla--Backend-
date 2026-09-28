import type { AuthActor } from "../api/v1/auth/auth.model.js";
declare global { namespace Express { interface Request { actor?: AuthActor; requestId?: string; } } }
export {};
