// Analyzer.js
import React, { useEffect, useState } from "react";
import {
  fetchComponentSchema,
  getQueryParam,
  calculateSimilarity,
  generateCSV,
} from "./utils";
import {
  Button,
  Typography,
  CircularProgress,
  Container,
  Box,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
} from "@mui/material";
import './Analyzer.css';

const SIMILARITY_THRESHOLD = 70;
const ITEMS_PER_PAGE = 20;

const Analyzer = () => {
  const [components, setComponents] = useState([]);
  const [report, setReport] = useState({ identical: [], similar: [], children: [] });
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [page, setPage] = useState({ identical: 1, similar: 1, children: 1 });

  const paginated = (data, type) =>
    data.slice((page[type] - 1) * ITEMS_PER_PAGE, page[type] * ITEMS_PER_PAGE);

  useEffect(() => {
    const analyze = async () => {
      const logs = [`Analysis started at ${new Date().toISOString()}`];
      try {
        const spaceId = getQueryParam("space_id");
        if (!spaceId) throw new Error("space_id not found in URL");

        const components = await fetchComponentSchema(spaceId);
        setComponents(components);
        logs.push(`Fetched ${components.length} components.`);

        const identical = [];
        const similar = [];
        const children = [];
        const errors = [];

        for (let i = 0; i < components.length; i++) {
          const compA = components[i];
          const fieldsA = compA.schema
            ? Object.entries(compA.schema).map(([k, v]) => ({ name: k, type: v.type }))
            : [];

          for (let j = i + 1; j < components.length; j++) {
            try {
              const compB = components[j];
              const fieldsB = compB.schema
                ? Object.entries(compB.schema).map(([k, v]) => ({ name: k, type: v.type }))
                : [];

              if (JSON.stringify(fieldsA) === JSON.stringify(fieldsB)) {
                identical.push([compA.name, compB.name, 100]);
              } else {
                const simAB = calculateSimilarity(fieldsA, fieldsB);
                const simBA = calculateSimilarity(fieldsB, fieldsA);
                const similarity = Math.max(simAB, simBA);

                if (similarity >= SIMILARITY_THRESHOLD && similarity < 100) {
                  similar.push([compA.name, compB.name, similarity]);
                }

                if (
                  fieldsB.length >= 3 &&
                  fieldsB.every((field) =>
                    fieldsA.some((f) => f.name === field.name && f.type === field.type)
                  )
                ) {
                  const parent = compA.name;
                  const child = compB.name;

                  // Calculate the percentage of parent fields that match the child
                  const parentMatchPercentage = fieldsA.length > 0
                    ? (fieldsB.filter((field) =>
                        fieldsA.some((f) => f.name === field.name && f.type === field.type)
                      ).length / fieldsA.length) * 100
                    : 0; // Default to 0 if fieldsA is empty

                  // Group children by parent with match percentage
                  const parentIndex = children.findIndex((item) => item.parent === parent);
                  if (parentIndex === -1) {
                    children.push({
                      parent,
                      children: [{ name: child, match: similarity, parentMatch: parentMatchPercentage }],
                    });
                  } else {
                    children[parentIndex].children.push({
                      name: child,
                      match: similarity,
                      parentMatch: parentMatchPercentage,
                    });
                  }
                }
              }
            } catch (e) {
              errors.push(`Error comparing ${i} and ${j}: ${e.message}`);
            }
          }
        }

        setReport({ identical, similar, children });
        logs.push(`Comparison done at ${new Date().toISOString()}`);
        logs.push(...errors);
      } catch (e) {
        logs.push(`Error: ${e.message}`);
      } finally {
        setLog(logs);
        setLoading(false);
      }
    };

    analyze();
  }, []);

  const handleDownload = () => {
    generateCSV(["S.No", "Component A", "Component B", "Match %"], report.identical.map((r, i) => [i + 1, ...r]), "identical_components");
    generateCSV(["S.No", "Component A", "Component B", "Overlap %"], report.similar.map((r, i) => [i + 1, ...r]), "similar_components");
    generateCSV(["Parent Component", "Child Component", "Match %", "Parent Match %"], report.children.flatMap((r) => r.children.map((child) => [r.parent, child.name, child.match, child.parentMatch])), "child_components");
  };

  const tabs = [
    {
      label: "Identical Components",
      data: report.identical,
      columns: ["S.No", "Component A", "Component B", "Match %"],
      message: "No Identical Components Found",
      type: "identical",
    },
    {
      label: "Similar Components",
      data: report.similar,
      columns: ["S.No", "Component A", "Component B", "Overlap %"],
      message: "No Similar Components Found",
      type: "similar",
    },
    {
      label: "Child Components",
      data: report.children,
      columns: ["Parent Component", "Child Component", "Match %", "Parent Match %"],
      message: "No Child Components Found",
      type: "children",
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Storyblok Component Analyzer</Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} textColor="primary" indicatorColor="primary">
              {tabs.map((t, i) => <Tab key={i} label={t.label} />)}
            </Tabs>
            <Button variant="contained" onClick={handleDownload}>Export CSV</Button>
          </Box>

          {tabs.map((tab, index) => (
            tabIndex === index && (
              <Box key={index}>
                {tab.data.length === 0 ? (
                  <Typography variant="body1">{tab.message}</Typography>
                ) : (
                  <>
                    {tab.type === "children" ? (
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>S.No</TableCell> {/* Add serial number column */}
                            <TableCell>Parent Component</TableCell>
                            <TableCell>Child Component</TableCell>
                            <TableCell>Match %</TableCell>
                            <TableCell>Parent Match %</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginated(tab.data, tab.type).map((row, i) => (
                            <React.Fragment key={i}>
                              {row.children.map((child, j) => (
                                <TableRow key={`${i}-${j}`}>
                                  <TableCell>{i * row.children.length + j + 1}</TableCell> {/* Sequential serial number logic */}
                                  <TableCell>{row.parent }</TableCell>
                                  <TableCell>{child.name}</TableCell>
                                  <TableCell>{child.match}%</TableCell>
                                  <TableCell>{child.parentMatch.toFixed(2)}%</TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Table>
                        <TableHead>
                          <TableRow>
                            {tab.columns.map((col, i) => (
                              <TableCell key={i}>{col}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginated(tab.data, tab.type).map((row, i) => (
                            <TableRow key={i}>
                              {tab.columns.map((_, j) => (
                                <TableCell key={j}>
                                  {j === 0
                                    ? i + 1 + (page[tab.type] - 1) * ITEMS_PER_PAGE
                                    : row[j - 1]}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    {tab.data.length > ITEMS_PER_PAGE && (
                      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                        <Pagination
                          count={Math.ceil(tab.data.length / ITEMS_PER_PAGE)}
                          page={page[tab.type]}
                          onChange={(_, val) =>
                            setPage((prev) => ({ ...prev, [tab.type]: val }))
                          }
                          color="primary"
                        />
                      </Box>
                    )}
                  </>
                )}
              </Box>
            )
          ))}

          <Box sx={{ mt: 4 }}>
            <Typography variant="h6">Logs</Typography>
            {log.map((line, i) => (
              <Typography key={i} variant="body2">{line}</Typography>
            ))}
          </Box>
        </>
      )}
    </Container>
  );
};

export default Analyzer;
