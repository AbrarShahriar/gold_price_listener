// @ts-check

import { PlaywrightCrawler } from "crawlee";
import { readFile, writeFile } from "fs/promises";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

let price;
let sendNotificationSwitch = true;
let call = 1;

const crawler = new PlaywrightCrawler({
  requestHandler: async ({ request, page, log }) => {
    const title = await page.title();
    log.info(`Title of ${request.loadedUrl} is '${title}'`);

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

app.get("/", async (req, res) => {
  let userThreshold = req.query.threshold;
  let threshold;

  if (!userThreshold) {
    let rawData = await readFile("./src/data.json", { encoding: "utf-8" });
    let data = JSON.parse(rawData);
    threshold = data.threshold;
  } else {
    // @ts-ignore
    threshold = parseFloat(userThreshold);
  }

  await crawler.run(["https://goldprice.org/"]);

  let goldPrice = price ? parsedPrice() : 0;

  if (goldPrice > threshold) {
    res.status(200).json({
      message: `gold price is greater than ${threshold} => ${goldPrice}`,
      curPrice: goldPrice,
      curThreshold: threshold,
    });
  } else {
    res.status(200).json({
      message: `gold price is less than ${threshold} => ${goldPrice}`,
      curPrice: goldPrice,
      curThreshold: threshold,
    });
  }
});

app.get("/notification", async (req, res) => {
  let rawData = await readFile("./src/data.json", { encoding: "utf-8" });
  let data = JSON.parse(rawData);
  let threshold = data.threshold;

  sendNotificationSwitch && (await crawler.run(["https://goldprice.org/"]));

  let goldPrice = price ? parsedPrice() : 0;

  console.log(goldPrice, threshold);

  if (goldPrice !== 0 && goldPrice > threshold) {
    if (sendNotificationSwitch) {
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
            en: `Gold Price is now ${goldPrice} which is above ${threshold}`,
          },
          headings: {
            en: `Gold Price Above Threshold!`,
          },
          name: "rest_api",
        }),
      });

      let data = await res.json();

      console.log(data);

      sendNotificationSwitch = false;
    }
  }

  res.status(200).json({ message: `Called ${call} time(s)` });

  call++;
});

app.post("/", async (req, res) => {
  var body = req.body;

  await writeFile("./src/data.json", JSON.stringify(body, null, 2), {
    encoding: "utf-8",
  });

  sendNotificationSwitch = true;

  res.status(201).json({ message: "threshold updated" });
});

app.listen(8080, () => {
  console.log("listening...");
});

function parsedPrice() {
  return parseFloat(price.split(",").join(""));
}
