// @ts-check

import { PlaywrightCrawler } from "crawlee";
import { readFile, writeFile } from "fs/promises";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

let price;
let sendAboveNotificationSwitch = true;
let sendBelowNotificationSwitch = true;
let call = 1;

const crawler = new PlaywrightCrawler({
  requestHandler: async ({ page }) => {
    let goldPriceContainer = page.locator(".gpoticker-price").first();

    let goldPrice = await goldPriceContainer.textContent();

    price = goldPrice;
  },
});

let app = express();

app.disable("etag");

app.use(
  cors({
    origin: "*",
    methods: "GET,POST,OPTIONS",
  })
);
app.use(express.json());

// ------------------------ GET DATA ------------------------
app.get("/", async (req, res) => {
  let rawData = await readFile("./src/data.json", { encoding: "utf-8" });
  let thresholds = JSON.parse(rawData);

  await crawler.run(["https://goldprice.org/"]);

  let goldPrice = price ? parsedPrice() : 0;

  res.status(200).json({
    curPrice: goldPrice,
    curMaxThreshold: thresholds.maxThreshold,
    curMinThreshold: thresholds.minThreshold,
  });
});

// ------------------------ UPDATE THRESHOLD ------------------------
app.post("/", async (req, res) => {
  var body = req.body;

  let rawData = await readFile("./src/data.json", { encoding: "utf-8" });
  let prevValues = JSON.parse(rawData);

  console.log(body, prevValues);

  if (body.maxThreshold && body.minThreshold) {
    if (body.minThreshold >= body.maxThreshold) {
      return res.status(403).json({
        message: `Min Threshold (${body.minThreshold}) cannot be greater than Max Threshold (${body.maxThreshold})`,
      });
    }

    sendAboveNotificationSwitch = true;
    sendBelowNotificationSwitch = true;
  } else if (body.maxThreshold && !body.minThreshold) {
    sendAboveNotificationSwitch = true;
  } else if (body.minThreshold && !body.maxThreshold) {
    sendBelowNotificationSwitch = true;
  }

  await writeFile(
    "./src/data.json",
    JSON.stringify({ ...prevValues, ...body }, null, 2),
    {
      encoding: "utf-8",
    }
  );

  res.status(201).json({ message: "threshold updated" });
});

// ------------------------ SEND NOTIFICATION ------------------------
app.get("/notification", async (req, res) => {
  let rawData = await readFile("./src/data.json", { encoding: "utf-8" });
  let thresholds = JSON.parse(rawData);

  (sendAboveNotificationSwitch || sendBelowNotificationSwitch) &&
    (await crawler.run(["https://goldprice.org/"]));

  let goldPrice = price ? parsedPrice() : 0;

  let data;

  console.log(goldPrice, thresholds);

  if (goldPrice !== 0 && goldPrice >= thresholds.maxThreshold) {
    data =
      sendAboveNotificationSwitch &&
      (await sendAboveNotification(goldPrice, thresholds));
  } else if (goldPrice !== 0 && goldPrice <= thresholds.minThreshold) {
    data =
      sendBelowNotificationSwitch &&
      (await sendBelowNotification(goldPrice, thresholds));
  }

  res.status(200).json({
    message: `Called ${call} time(s)`,
    notificationSent: Boolean(data),
  });

  call++;
});

async function sendAboveNotification(goldPrice, thresholds) {
  let res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      included_segments: ["Subscribed Users"],
      contents: {
        en: `Gold Price is now ${goldPrice} which is above ${thresholds.maxThreshold}`,
      },
      headings: {
        en: `SELL! Gold Price: ${goldPrice}`,
      },
      name: "above",
    }),
  });

  let data = await res.json();

  console.log(data);
  sendAboveNotificationSwitch = false;

  return data;
}

async function sendBelowNotification(goldPrice, thresholds) {
  let res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      included_segments: ["Subscribed Users"],
      contents: {
        en: `Gold Price is now ${goldPrice} which is below ${thresholds.minThreshold}`,
      },
      headings: {
        en: `BUY! Gold Price: ${goldPrice}`,
      },
      name: "below",
    }),
  });

  let data = await res.json();

  console.log(data);

  sendBelowNotificationSwitch = false;

  return data;
}

app.listen(8080, () => {
  console.log("listening...");
});

function parsedPrice() {
  return parseFloat(price.split(",").join(""));
}
