import { json } from "@sveltejs/kit";
const prerender = false;
const GET = async () => {
  return json({
    status: "ok",
    service: "vitamoospace",
    version: "0.1.0",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
};
export {
  GET,
  prerender
};
