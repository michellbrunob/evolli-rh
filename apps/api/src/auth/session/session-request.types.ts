import { AccessSession, AccessUser } from "@prisma/client";

declare module "express" {
  interface Request {
    authUser?: AccessUser;
    authSession?: AccessSession;
  }
}
