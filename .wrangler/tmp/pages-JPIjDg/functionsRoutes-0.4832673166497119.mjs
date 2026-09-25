import { onRequestGet as __api_callback_js_onRequestGet } from "C:\\Users\\suhey\\Downloads\\isler\\MDDStudio-repo\\functions\\api\\callback.js"
import { onRequestPost as __api_callback_js_onRequestPost } from "C:\\Users\\suhey\\Downloads\\isler\\MDDStudio-repo\\functions\\api\\callback.js"
import { onRequestPost as __api_checkout_js_onRequestPost } from "C:\\Users\\suhey\\Downloads\\isler\\MDDStudio-repo\\functions\\api\\checkout.js"
import { onRequestGet as __api_config_js_onRequestGet } from "C:\\Users\\suhey\\Downloads\\isler\\MDDStudio-repo\\functions\\api\\config.js"

export const routes = [
    {
      routePath: "/api/callback",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_callback_js_onRequestGet],
    },
  {
      routePath: "/api/callback",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_callback_js_onRequestPost],
    },
  {
      routePath: "/api/checkout",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_checkout_js_onRequestPost],
    },
  {
      routePath: "/api/config",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_config_js_onRequestGet],
    },
  ]