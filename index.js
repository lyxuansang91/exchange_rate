const axios = require("axios");
const parser = require("xml2json");
const Decimal = require("decimal.js");
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";

Decimal.set({ precision: 8, rounding: 4 });

const config = {
  headers: { "Content-Type": "text/xml" }
};

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
  return ["BTC", "ETH", "USDT"];
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
      if (currencyData && currencyData !== fiat) {
        res[fiat][`${currency}/${fiat}`] = currencyData[fiat];
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

  const fiatPrices = await getPriceMulti(formatUrl, fromCurrencies, fiats);
  const currencyPrices = await getPriceMulti(
    formatUrl,
    toCurrencies,
    fromCurrencies
  );
  return { ...fiatPrices, ...currencyPrices };
};

// getRates().then(console.log);

const app = express();

app.use(cors());

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
