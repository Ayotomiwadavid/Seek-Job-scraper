const express = require("express");
const puppeteer = require("puppeteer");
const axios = require("axios");
require("dotenv").config(); // For environment variables
const { execSync } = require("child_process"); // To execute shell commands

const app = express();
const PORT = 8000;

// WordPress credentials and default configurations
const WP_API_URL = "https://ausjobs.net/wp-json/wp/v2/job_listing";
const WP_USERNAME = process.env.WP_USERNAME;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;
const DEFAULT_IMAGE_URL =
  "https://ausjobs.net/wp-content/uploads/2024/11/Job-advert-external-1024x641-1.jpeg";
const BASE_URL = "https://www.seek.com.au/jobs";

// Set to track posted job URLs
let postedJobUrls = new Set();

// Install necessary Chrome version
async function ensurePuppeteerSetup() {
  console.log("Ensuring Puppeteer is properly set up...");
  try {
    execSync("npx puppeteer browsers install chrome", { stdio: "inherit" });
    console.log("Puppeteer setup complete.");
  } catch (error) {
    console.error("Error setting up Puppeteer:", error.message);
    throw error;
  }
}

// Scraping function
async function scrapeJobs(pageNumber = 1) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // Added for Docker compatibility
  });
  const page = await browser.newPage();
  const url = `${BASE_URL}?page=${pageNumber}`;
  console.log(`Navigating to: ${url}`);

  try {
    await page.goto(url, { waitUntil: "load", timeout: 0 });
    const jobs = await page.evaluate(() => {
      const jobCards = document.querySelectorAll("._1viagsn5b._1viagsnhf");
      const jobData = [];
      jobCards.forEach((card) => {
        const title = card.querySelector("a[data-automation='jobTitle']")?.textContent.trim();
        const jobUrl = card.querySelector("a[data-automation='jobTitle']")?.href;
        const company = card.querySelector("a[data-automation='jobCompany']")?.textContent.trim();
        const location = card.querySelector("a[data-automation='jobLocation']")?.textContent.trim();
        const salary = card.querySelector("span[data-automation='jobSalary']")?.textContent.trim();
        const description = card.querySelector("span[data-automation='jobShortDescription']")?.textContent.trim();

        if (title && jobUrl) {
          jobData.push({
            title,
            jobUrl,
            company: company || "Not specified",
            location: location || "Not specified",
            salary: salary || "Not specified",
            JobDecription: description || "Not Specified",
          });

          console.log({
            title,
            jobUrl,
            company: company || "Not specified",
            location: location || "Not specified",
            salary: salary || "Not specified",
            JobDecription: description || "Not Specified",
          });
        }
      });
      return jobData;
    });

    await browser.close();
    return jobs;
  } catch (error) {
    console.error("Error scraping jobs:", error.message);
    await browser.close();
    return [];
  }
}

// Post to WordPress
async function postJobToWordPress(job) {
  if (postedJobUrls.has(job.jobUrl)) {
    console.log(`Job already posted: ${job.title}`);
    return null;
  }

  try {
    const response = await axios.post(
      WP_API_URL,
      {
        title: job.title,
        content: `<img src="${DEFAULT_IMAGE_URL}" alt="Job Image"/><br>Company: ${job.company}<br>Location: ${job.location}<br>Salary: ${job.salary}<br> Description: ${job.JobDecription}<br> <a href="${job.jobUrl}">Apply Here</a>`,
        status: "publish",
        meta: {
          _application: job.jobUrl,
          _job_location: job.location, // Explicitly map location here
        },
        link: job.jobUrl,
      },
      {
        auth: {
          username: WP_USERNAME,
          password: WP_APP_PASSWORD,
        },
      }
    );

    postedJobUrls.add(job.jobUrl);
    console.log(`Job posted: ${job.title}`);
    return response.data;
  } catch (error) {
    console.error(`Error posting job: ${job.title}`, error.response?.data || error.message);
    return null;
  }
}

// Main scraping and posting logic
async function scrapeAndPostJobs() {
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    console.log(`Scraping page ${currentPage}...`);
    const jobs = await scrapeJobs(currentPage);

    console.log(jobs);

    if (jobs.length === 0) {
      console.log("No jobs found. Stopping...");
      break;
    }

    for (const job of jobs) {
      await postJobToWordPress(job);
    }

    hasNextPage = jobs.length > 0;
    currentPage++;
  }

  console.log("Scraping and posting completed.");
}

// Express route for triggering the scrape
const start = async () => {
  try {
    await ensurePuppeteerSetup(); // Ensure Puppeteer is ready
    await scrapeAndPostJobs();
    console.log("Scraping and posting jobs completed successfully!");
  } catch (error) {
    console.error("Error in scraping route:", error.message);
    console.log("An error occurred while scraping jobs.");
  }
};

// Start the server
app.listen(PORT, () => {
  start();
  console.log(`Server running on http://localhost:${PORT}`);
});
