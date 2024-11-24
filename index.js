const express = require("express");
const axios = require("axios");
require("dotenv").config(); // For environment variables
const { ApifyClient } = require('apify-client');

const app = express();
const PORT = 8000;

const dataSetItems = [];

// Initialize Apify Client with environment variables
const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

// Fetch data from Apify
const fetchApifyData = async () => {
    try {
        // Starts an actor and waits for it to finish
        const { defaultDatasetId } = await client.actor('websift/seek-job-scraper').call();
        
        // Fetches results from the actor's dataset
        const { items } = await client.dataset(defaultDatasetId).listItems();

        // Clear previous dataSetItems to prevent duplication
        dataSetItems.length = 0;

        for (const item of items) {
            dataSetItems.push({
                title: item.title,
                description: item.content.jobHook,
                salary: item.salary.amount !== 'N/A' ? `${item.salary.amount} ${item.salary.currency}` : 'Not specified',
                location: item.joblocationInfo.displayLocation,
                jobLink: item.jobLink,
                image: item.advertiser.logo || 'No image available',
                company: item.advertiser.name || 'No company specified',
            });

            console.log({
                title: item.title,
                description: item.content.jobHook,
                salary: item.salary.amount !== 'N/A' ? `${item.salary.amount} ${item.salary.currency}` : 'Not specified',
                location: item.joblocationInfo.displayLocation,
                jobLink: item.jobLink,
                image: item.advertiser.logo || 'No image available',
                company: item.advertiser.name || 'No company specified',
            });
        }

        return { msg: 'Fetching completed' };
    } catch (error) {
        console.error("Error fetching data:", error.message);
        return { msg: 'Fetching failed' };
    }
};

// Set to track posted job URLs
let postedJobUrls = new Set();

// Post to WordPress
async function postJobToWordPress(job) {
    // Check if the job URL has already been posted
    if (postedJobUrls.has(job.jobLink)) {
        console.log(`Job already posted: ${job.title}`);
        return null;
    }

    try {
        const response = await axios.post(
            process.env.WP_API_URL,
            {
                title: job.title,
                content: `<img src="${job.image}" alt="Job Image"/><br>Company: ${job.company}<br>Location: ${job.location}<br>Salary: ${job.salary}<br>Description: ${job.description}<br><a href="${job.jobLink}">Apply Here</a>`,
                status: "publish",
                meta: {
                    _application: job.jobLink,
                    _job_location: job.location,
                },
            },
            {
                auth: {
                    username: process.env.WP_USERNAME,
                    password: process.env.WP_APP_PASSWORD,
                },
            }
        );

        // Add the job URL to the set to prevent future duplicates
        postedJobUrls.add(job.jobLink);
        console.log(`Job posted: ${job.title}`);
        return response.data;
    } catch (error) {
        console.error(`Error posting job: ${job.title}`, error.response?.data || error.message);
        return null;
    }
}

// Schedule the daily task
const scheduleDailyTask = () => {
    const now = new Date(); // Current time
    const targetTime = new Date(); // Target 4:00 PM today

    targetTime.setHours(16, 0, 0, 0); // Set target time to 4:00 PM (24-hour format)

    // If it's past 4:00 PM today, schedule for tomorrow
    if (now > targetTime) {
        targetTime.setDate(targetTime.getDate() + 1);
    }

    // Calculate the initial delay (time until next 4:00 PM)
    const initialDelay = targetTime - now;

    // Schedule the function to run at the target time
    setTimeout(async () => {
        const response = await fetchApifyData();

        if (response.msg === 'Fetching completed') {
            for (const job of dataSetItems) {
                await postJobToWordPress(job);
            }
        }

        // Use setInterval to run it every 24 hours afterward
        setInterval(async () => {
            const response = await fetchApifyData();
            if (response.msg === 'Fetching completed') {
                for (const job of dataSetItems) {
                    await postJobToWordPress(job);
                }
            }
        }, 24 * 60 * 60 * 1000); // Every 24 hours
    }, initialDelay);
};

// Start the scheduling
scheduleDailyTask();

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
