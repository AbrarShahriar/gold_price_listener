// @ts-check

import { createServer } from "http";
import { PlaywrightCrawler } from "crawlee";
import { readFile, writeFile } from "fs/promises";

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

async function handleReqMethod(req, res) {
  if (req.method == "GET") {
    let userThreshold = parseUrl(req);
    let threshold = await defineThreshold(userThreshold);

    await crawler.run(["https://goldprice.org/"]);

    let goldPrice = definePrice();
    GET$handleAndSendRes(res, goldPrice, threshold);
  } else if (req.method == "POST") {
    await POST$handleAndSendRes(req, res);
  }

  res.end();
}

async function POST$handleAndSendRes(req, res) {
  var body = "";
  req.on("data", function (data) {
    body += data;
    console.log("Partial body: " + body);
  });
  req.on("end", async function () {
    await writeFile("./src/data.json", body, {
      encoding: "utf-8",
    });
  });

  res.write("threshold updated");
}

function definePrice() {
  if (price) {
    return parsedPrice();
  } else {
    return 0;
  }
}

function parsedPrice() {
  return parseFloat(price.split(",").join(""));
}

async function defineThreshold(userThreshold) {
  let threshold;
  if (!userThreshold) {
    let rawData = await readFile("./src/data.json", { encoding: "utf-8" });
    let data = JSON.parse(rawData);
    threshold = data.threshold;
  } else {
    threshold = userThreshold;
  }
  return threshold;
}

function parseUrl(req) {
  //@ts-ignore
  let urlObj = new URL(req.url, `http://${req.headers.host}`);
  //@ts-ignore
  let userThreshold = parseFloat(urlObj.searchParams.get("threshold"));

  return userThreshold;
}

function GET$handleAndSendRes(res, goldPrice, threshold) {
  if (goldPrice > threshold) {
    res.write(`gold price is greater than ${threshold} => ${goldPrice}`);
  } else {
    res.write(`gold price is less than ${threshold} => ${goldPrice}`);
  }
}

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
  res.setHeader("Access-Control-Max-Age", 2592000);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
}

let server = createServer(async (req, res) => {
  cors(req, res);
  handleReqMethod(req, res);
});

server.listen(8080, undefined, undefined, () => {
  console.log("listening...");
});
