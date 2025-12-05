// ===== API entrypoint =====
module.exports = {
  groqweb: require("./groqweb"),
  chat: {
    groq: require("./chat/groq")
  },
  search: {
    router: require("./search/router"),
    braveApi: require("./search/braveApi"),
    bing: require("./search/bing"),
    googlePSE: require("./search/googlePSE"),
    groq: require("./search/groq"),
    serpapi: require("./search/serpapi")
  },
  utils: {
    formatter: require("./utils/formatter"),
    providerSelector: require("./utils/providerSelector")
  }
};
