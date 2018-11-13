const axios = require("axios");
const parser = require("xml2json");
const Decimal = require("decimal.js");
const express = require("express");
const Promise = require("bluebird");
const port = 3000;
const host = "0.0.0.0";

Decimal.set({ precision: 8, rounding: 4 });

const config = {
  headers: { "Content-Type": "text/xml" }
};

const cmc_configs = {
  headers: { "X-CMC_PRO_API_KEY": "25714388-61d4-46fa-9279-d13e54a54b90" }
};

const cms_configs_sandbox = {
  headers: { "X-CMC_PRO_API_KEY": "83440b9b-d5e6-43c6-8a5f-7207e3d47b2b" }
};

String.prototype.format = function() {
  let formatted = this;
  for (let i = 0; i < arguments.length; i++) {
    let regexp = new RegExp("\\{" + i + "\\}", "gi");
    formatted = formatted.replace(regexp, arguments[i]);
  }
  return formatted;
};

const getFiats = async urlExchangeRate => {
  return ["USD", "SGD", "EUR", "VND"];
};

const getPricesByFiat = async (cmcUrl, currencies, fiat) => {
  // const id = listing[currency];
  const currencyQS = currencies.join(",");
  const url = cmcUrl.format(currencyQS, fiat);
  let resp = null;
  try {
    resp = (await axios.get(url, cms_configs_sandbox)).data;
  } catch (error) {}
  if (!resp) return null;
  const { data } = resp;
  const prices = {};
  currencies.forEach(currency => {
    try {
      const { quote } = data[currency];
      const { price } = quote[fiat];
      const pair = `${currency}/${fiat}`;
      prices[pair] = new Decimal(price).toFixed();
    } catch (error) {
      console.log(error);
    }
  });

  // const usdInfo = quotes.USD;
  return prices;
};

const getRates = async () => {
  const currencies = ["BTC", "ETH", "USDT"];
  const cmcUrl =
    "http://sandbox-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol={0}&convert={1}";

  const fiats = await getFiats(
    "http://www.vietcombank.com.vn/exchangerates/ExrateXML.aspx"
  );
  const resp = {};
  await Promise.each(
    fiats,
    async fiat => {
      const res = await getPricesByFiat(cmcUrl, currencies, fiat);
      if (res) resp[fiat] = res;
    },
    { concurrency: 10 }
  );
  return resp;
};

/* http://sandbox-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ETH,BTC&quote=USD */
// {
//   "status": {
//       "timestamp": "2018-11-13T08:25:50.805Z",
//       "error_code": 0,
//       "error_message": null,
//       "elapsed": 8,
//       "credit_count": 1
//   },
//   "data": {
//       "BTC": {
//           "id": 1,
//           "name": "Bitcoin",
//           "symbol": "BTC",
//           "slug": "bitcoin",
//           "circulating_supply": 17214587,
//           "total_supply": 17214587,
//           "max_supply": 21000000,
//           "date_added": "2013-04-28T00:00:00.000Z",
//           "num_market_pairs": 5718,
//           "cmc_rank": 1,
//           "last_updated": "2018-08-17T08:55:37.000Z",
//           "quote": {
//               "USD": {
//                   "price": 6493.02288075,
//                   "volume_24h": 4858871494.40995,
//                   "percent_change_1h": 0.0196847,
//                   "percent_change_24h": 1.23932,
//                   "percent_change_7d": 0.377056,
//                   "market_cap": 111774707273.6615,
//                   "last_updated": "2018-08-17T08:55:37.000Z"
//               }
//           }
//       },
//       "ETH": {
//           "id": 1027,
//           "name": "Ethereum",
//           "symbol": "ETH",
//           "slug": "ethereum",
//           "circulating_supply": 101377382.6553,
//           "total_supply": 101377382.6553,
//           "max_supply": null,
//           "date_added": "2015-08-07T00:00:00.000Z",
//           "num_market_pairs": 3869,
//           "cmc_rank": 2,
//           "last_updated": "2018-08-17T08:54:55.000Z",
//           "quote": {
//               "USD": {
//                   "price": 300.96820061,
//                   "volume_24h": 1689698769.04551,
//                   "percent_change_1h": -0.200328,
//                   "percent_change_24h": 3.14457,
//                   "percent_change_7d": -16.8554,
//                   "market_cap": 30511368440.317066,
//                   "last_updated": "2018-08-17T08:54:55.000Z"
//               }
//           }
//       }
//   }
// }

// getExchangeRate("http://www.vietcombank.com.vn/exchangerates/ExrateXML.aspx")

const app = express();

app.get("/exchange_rate", (req, res) => {
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

app.listen(port, host, () => {
  console.log(`exchange rate is listening on ${port}`);
});
