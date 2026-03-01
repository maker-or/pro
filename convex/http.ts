import { httpRouter } from "convex/server";
import { publicaction } from "./secert";

const http = httpRouter();

http.route({
	path: "/verify-api-key",
	method: "POST",
	handler: publicaction,
});

export default http;
