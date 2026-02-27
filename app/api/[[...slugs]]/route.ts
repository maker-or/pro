import { Elysia } from "elysia";

import { machine } from "../../machine";

const app = new Elysia({ prefix: "/api" }).use(machine);

export const GET = app.fetch;
export const POST = app.fetch;
