// @ts-check

import { PlaywrightCrawler } from "crawlee";
import { readFile, writeFile } from "fs/promises";
import express from "express";
import cors from "cors";

let price;

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

app.use(cors());

app.get("/", async (req, res) => {
  let userThreshold = req.query.threshold;
  let threshold;

  if (!userThreshold) {
    let rawData = await readFile("./src/data.json", { encoding: "utf-8" });
    let data = JSON.parse(rawData);
    threshold = data.threshold;
  } else {
    threshold = userThreshold;
  }

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

  await crawler.run(["https://goldprice.org/"]);
});

app.post("/", async (req, res) => {
  var body = req.body;

  await writeFile("./src/data.json", body, {
    encoding: "utf-8",
  });

  res.status(201).json({ message: "threshold updated" });
});

app.listen(8080, () => {
  console.log("listening...");
});

function parsedPrice() {
  return parseFloat(price.split(",").join(""));
}
