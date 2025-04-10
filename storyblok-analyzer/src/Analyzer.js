import React, { useEffect, useState } from "react";
import {
  fetchComponentSchema,
  getQueryParam,
  calculateSimilarity,
  generateCSV,
} from "./utils";

const SIMILARITY_THRESHOLD = 70; // Threshold for similarity percentage

const Analyzer = () => {
  const [components, setComponents] = useState([]); // State to store fetched components
  const [report, setReport] = useState({ identical: [], similar: [], children: [] }); // State to store analysis report
  const [log, setLog] = useState([]); // State to store logs
  const [loading, setLoading] = useState(true); // State to manage loading status

  useEffect(() => {
    const analyze = async () => {
      const logs = [`Analysis started at ${new Date().toISOString()}`];
      try {
        const spaceId = getQueryParam("space_id"); // Get space_id from URL
        if (!spaceId) throw new Error("space_id not found in URL");

        const components = await fetchComponentSchema(spaceId); // Fetch components from API
        setComponents(components);
        logs.push(`Fetched ${components.length} components.`);

        const identical = [], similar = [], children = [], errors = [];

        // Compare components for identical and similar fields
        for (let i = 0; i < components.length; i++) {
          for (let j = i + 1; j < components.length; j++) {
            try {
              const compA = components[i];
              const compB = components[j];

              const fieldsA = compA.schema ? Object.values(compA.schema) : [];
              const fieldsB = compB.schema ? Object.values(compB.schema) : [];

              if (JSON.stringify(fieldsA) === JSON.stringify(fieldsB)) {
                identical.push([compA.name, compB.name, "100"]); // Identical components
              } else {
                const similarity = calculateSimilarity(fieldsA, fieldsB);
                if (similarity >= SIMILARITY_THRESHOLD) {
                  similar.push([compA.name, compB.name, similarity]); // Similar components
                }
              }

              // Check for parent-child relationships
              fieldsA.forEach((field) => {
                if (
                  field.component_whitelist?.includes(compB.name) ||
                  (field.type === "bloks" && field.restrict_components?.includes(compB.name))
                ) {
                  children.push([compA.name, compB.name]);
                }
              });
            } catch (err) {
              errors.push(`Error comparing: ${err.message}`); // Log errors
            }
          }
        }

        logs.push(`Compared ${components.length} components.`);
        logs.push(...errors);

        setReport({ identical, similar, children }); // Update report state
      } catch (err) {
        logs.push(`Error: ${err.message}`); // Log errors
      } finally {
        setLog(logs); // Update logs state
        setLoading(false); // Set loading to false
      }
    };

    setTimeout(analyze, 1000); // Delay analysis for 1 second
  }, []);

  // Function to download all reports as CSV files
  const downloadAllReports = () => {
    generateCSV(["S.No", "Component A", "Component B", "Match %"], report.identical.map((r, i) => [i + 1, ...r]), "identical_components");
    generateCSV(["S.No", "Component A", "Component B", "Overlap %"], report.similar.map((r, i) => [i + 1, ...r]), "similar_components");
    generateCSV(["Parent", "Child"], report.children, "child_components");
  };

  return (
    <div className="p-6">
      <h2>Storyblok Component Analyzer</h2>
      {loading ? <p>Loading...</p> : (
        <>
          {/* Display identical components */}
          <h3>Identical Components</h3>
          {report.identical.length ? (
            <ul>{report.identical.map((row, i) => (
              <li key={i}>{row.join(" - ")}%</li>
            ))}</ul>
          ) : <p>No Identical Components Found</p>}

          {/* Display similar components */}
          <h3>Similar Components</h3>
          {report.similar.length ? (
            <ul>{report.similar.map((row, i) => (
              <li key={i}>{row.join(" - ")}%</li>
            ))}</ul>
          ) : <p>No Similar Components Found</p>}

          {/* Display child components */}
          <h3>Child Components</h3>
          {report.children.length ? (
            <ul>{report.children.map((row, i) => (
              <li key={i}>{row.join(" → ")}</li>
            ))}</ul>
          ) : <p>No Child Components Found</p>}

          <button onClick={downloadAllReports}>Download CSV Reports</button>

          {/* Display logs */}
          <h4>Logs</h4>
          <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </>
      )}
    </div>
  );
};

export default Analyzer;
