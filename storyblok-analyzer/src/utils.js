import { saveAs } from "file-saver"; // Library for saving files
import axios from "axios"; // HTTP client for making API requests

// Function to get a query parameter value from the URL
export const getQueryParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
};

// Function to fetch the component schema from the Storyblok API
export const fetchComponentSchema = async (spaceId) => {
  const url = `https://api-us.storyblok.com/v1/spaces/${spaceId}/components`;
  const response = await axios.get(url, {
    headers: {
      Authorization: process.env.REACT_APP_MANAGEMENT_TOKEN, // API token from environment variables
      "Content-Type": "application/json",
    },
  });
  return response.data.components; // Return the components data
};

// Function to calculate similarity between two sets of fields
export const calculateSimilarity = (fieldsA, fieldsB) => {
    const matchCount = fieldsA.filter((field) =>
      fieldsB.some((f) => f.name === field.name && f.type === field.type)
    ).length;
    return Math.round((matchCount / fieldsA.length) * 100 * 10) / 10; // Return similarity percentage
};

// Function to generate a CSV file and trigger download
export const generateCSV = (headers, rows, filename) => {
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, `${filename}_${new Date().toISOString()}.csv`); // Save the file with a timestamp
};
