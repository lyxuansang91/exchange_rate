const axios = require("axios");
const parser = require("xml2json");
const Decimal = require("decimal.js");
const express = require("express");
const debug = require("debug")("debug");
const cors = require("cors");
const apicache = require("apicache");
const expressLogging = require("express-logging");
logger = require("logops");
const DURATION = 5 * 1000 * 60;

const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";
let marketCapResp = {};

Decimal.set({ precision: 8, rounding: 4 });

String.prototype.format = function() {
  let formatted = this;
  for (let i = 0; i < arguments.length; i++) {
    let regexp = new RegExp("\\{" + i + "\\}", "gi");
    formatted = formatted.replace(regexp, arguments[i]);
  }
  return formatted;
};

const getFiats = () => {
  return ["USD", "SGD", "EUR", "GBP", "JPY", "VND"];
};

const getFromCurrencies = () => {
  return ["BTC", "ETH", "USDT", "USD"];
};

const getToCurrencies = () => {
  return [
    "ETH",
    "BTC",
    "USDT",
    "XRP",
    "NEO",
    "DOGE",
    "DASH",
    "LTC",
    "XVG",
    "XMR",
    "STRAT"
  ];
};

const getPriceMulti = async (formatUrl, currencies, fiats) => {
  const currenciesQS = currencies.join(",");
  const fiatQS = fiats.join(",");
  const url = formatUrl.format(currenciesQS, fiatQS);
  let resp = null;
  try {
    resp = (await axios.get(url)).data;
  } catch (error) {
    resp = null;
  }
  const res = {};
  if (!resp) return res;
  fiats.forEach(fiat => {
    res[fiat] = {};
    currencies.forEach(currency => {
      const currencyData = resp[currency];
      if (currencyData && currency !== fiat) {
        res[fiat][`${currency}/${fiat}`] = new Decimal(
          currencyData[fiat]
        ).toFixed();
      }
    });
  });
  return res;
};

const getRates = async () => {
  const fromCurrencies = getFromCurrencies();
  const toCurrencies = getToCurrencies();
  const fiats = getFiats();
  const formatUrl =
    "https://min-api.cryptocompare.com/data/pricemulti?fsyms={0}&tsyms={1}";

  const fiatPricePromise = getPriceMulti(formatUrl, fromCurrencies, fiats);
  const currencyPricePromise = getPriceMulti(
    formatUrl,
    toCurrencies,
    fromCurrencies
  );

  const [fiatPrices, currencyPrices] = await Promise.all([
    fiatPricePromise,
    currencyPricePromise
  ]);

  return { ...fiatPrices, ...currencyPrices };
};

const getMarketCap = async () => {
  const url =
    "https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest";
  const config = {
    headers: {
      // "X-CMC_PRO_API_KEY": "25714388-61d4-46fa-9279-d13e54a54b90",
      "X-CMC_PRO_API_KEY": "78fae493-0c57-46ee-a979-94826dc6e80c"
    }
  };
  let resp = null;
  try {
    resp = (await axios.get(url, config)).data;
    console.log(resp);
  } catch (error) {
    resp = null;
  }
  const { data, status } = resp;
  if (status.error_code === 0) {
    return {
      error_code: status.error_code,
      btc_dominance: data.btc_dominance,
      eth_dominance: data.eth_dominance,
      total_market_cap: data.quote["USD"].total_market_cap || 0,
      total_volume_24h: data.quote["USD"].total_volume_24h || 0
    };
  }
  // error_code != 0
  return {
    error_code: status.error_code,
    error_message: status.error_message
  };
};

const getMarketCapInterval = () => {
  console.log("get market cap response");
  getMarketCap().then(val => {
    marketCapResp = val;
  });
  const interval = setInterval(() => {
    console.log("get market cap response");
    getMarketCap().then(val => {
      marketCapResp = val;
    });
  }, DURATION);
  return interval;
};

const startServer = async () => {
  const app = express();
  const cache = apicache.middleware;
  app.use(expressLogging(logger));
  const worker = getMarketCapInterval();

  app.use(cors());

  app.get("/marketcap", (req, res) => {
    res.status(marketCapResp.error_code === 0 ? 200 : 500);
    res.json(marketCapResp);
  });

  app.get("/exchange_rate", cache("5 minutes"), (req, res) => {
    getRates()
      .then(values => {
        res.status(200);
        res.json(values);
      })
      .catch(error => {
        res.status(200);
        res.json({
          message: error.stack
        });
      });
  });

  const server = app.listen(port, host, () => {
    console.log(`exchange rate is listening on ${port}`);
  });

  return { worker, server };
};

const shutdown = ({ worker, server }) => {
  console.log("Received kill signal, shutting down gracefully");
  if (server) {
    server.close();
    console.log("Closed out remaining connections");
    process.exit(0);
  }

  // We will wait for 1 minute, after that we force the process to shutdown
  const forceExit = setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 60 * 1000);

  // Stop the only worker
  clearTimeout(forceExit);
  clearInterval(worker);
  console.log("Clear interval worker");
  process.exit(0);
};

const registerSignals = app => {
  process.on("SIGTERM", () => shutdown(app));
  process.on("SIGINT", () => shutdown(app));
};

startServer()
  .then(registerSignals)
  .catch(error => {
    console.log(error);
    process.exit(1);
  });
