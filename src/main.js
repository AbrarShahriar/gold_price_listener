// @ts-check

import { createServer } from "http";
import { PlaywrightCrawler } from "crawlee";

let price;

const crawler = new PlaywrightCrawler({
  requestHandler: async ({ request, page, log }) => {
    const title = await page.title();
    log.info(`Title of ${request.loadedUrl} is '${title}'`);

    let goldPriceContainer = page.locator(".gpoticker-price").first();

    let goldPrice = await goldPriceContainer.textContent();

    price = goldPrice;
  },
  // headless: false,
});

let server = createServer(async (req, res) => {
  //@ts-ignore
  let urlObj = new URL(req.url, `http://${req.headers.host}`);

  //@ts-ignore
  let threshold = parseFloat(urlObj.searchParams.get("threshold"));

  await crawler.run(["https://goldprice.org/"]);

  let goldPrice = 0;

  if (price) {
    goldPrice = parseFloat(price.split(",").join(""));
  }

  if (goldPrice > threshold) {
    res.write(`gold price is greater than ${threshold} => ${goldPrice}`);
  } else {
    res.write(`gold price is less than ${threshold} => ${goldPrice}`);
  }

  res.end();
});

server.listen(8080, undefined, undefined, () => {
  console.log("listening...");
});
