import { createServer } from "http";
import { PlaywrightCrawler } from "crawlee";

let price = "";

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
  await crawler.run(["https://goldprice.org/"]);

  let goldPrice = 0;

  if (price) {
    goldPrice = parseFloat(price.split(",").join(""));
  }

  if (goldPrice > 1920) {
    res.write(`gold price is greater than 1920 => ${goldPrice}`);
  } else {
    res.write(`gold price is less than 1920 => ${goldPrice}`);
  }

  res.end();
});

server.listen(8080, undefined, undefined, () => {
  console.log("listening...");
});
