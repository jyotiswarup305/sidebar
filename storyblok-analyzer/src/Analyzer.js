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
import "./Analyzer.css";

const SIMILARITY_THRESHOLD = 70;
const ITEMS_PER_PAGE = 20;

const Analyzer = () => {
  const [components, setComponents] = useState([]);
  const [report, setReport] = useState({ identical: [], similar: [], children: [] });
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [page, setPage] = useState({ identical: 1, similar: 1, children: 1 });
  const [childSortOrder, setChildSortOrder] = useState("desc");
  const [similarSortOrder, setSimilarSortOrder] = useState("desc");

  const toggleChildSortOrder = () => {
    setChildSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const toggleSimilarSortOrder = () => {
    setSimilarSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const paginated = (data, type) =>
    data.slice((page[type] - 1) * ITEMS_PER_PAGE, page[type] * ITEMS_PER_PAGE);

  const getFlattenedChildren = () => {
    const sorted = [...report.children].sort((a, b) => {
      const aAvg =
        a.children.reduce((sum, c) => sum + c.parentMatch, 0) / a.children.length;
      const bAvg =
        b.children.reduce((sum, c) => sum + c.parentMatch, 0) / b.children.length;
      return childSortOrder === "asc" ? aAvg - bAvg : bAvg - aAvg;
    });

    return sorted.flatMap((item) =>
      item.children.map((child) => ({
        parent: item.parent,
        childName: child.name,
        match: child.match,
        parentMatch: child.parentMatch,
      }))
    );
  };

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

              const isIdentical =
                fieldsA.length === fieldsB.length &&
                fieldsA.every((fA) =>
                  fieldsB.some((fB) => fA.name === fB.name && fA.type === fB.type)
                );

              if (isIdentical) {
                identical.push([compA.name, compB.name, 100]);
                continue;
              }

              const simAB = calculateSimilarity(fieldsA, fieldsB);
              const simBA = calculateSimilarity(fieldsB, fieldsA);
              const similarity = Math.max(simAB, simBA);

              if (similarity >= SIMILARITY_THRESHOLD && similarity < 100) {
                similar.push([compA.name, compB.name, similarity]);
              }

              const matchedFields = fieldsB.filter((field) =>
                fieldsA.some((f) => f.name === field.name && f.type === field.type)
              );
              const isSubset =
                fieldsB.length >= 3 &&
                matchedFields.length === fieldsB.length &&
                matchedFields.length < fieldsA.length;

              if (isSubset) {
                const parent = compA.name;
                const child = compB.name;

                const parentMatchPercentage =
                  (matchedFields.length / fieldsA.length) * 100;

                const parentIndex = children.findIndex(
                  (item) => item.parent === parent
                );

                const childInfo = {
                  name: child,
                  match: similarity,
                  parentMatch: parentMatchPercentage,
                };

                if (parentIndex === -1) {
                  children.push({ parent, children: [childInfo] });
                } else {
                  children[parentIndex].children.push(childInfo);
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
    if (tabIndex === 0) {
      // Identical Components
      generateCSV(
        ["S.No", "Component A", "Component B", "Match %"],
        report.identical.map((r, i) => [i + 1, ...r]),
        "identical_components"
      );
    } else if (tabIndex === 1) {
      // Similar Components
      const sortedSimilar = [...report.similar].sort((a, b) =>
        similarSortOrder === "asc" ? a[2] - b[2] : b[2] - a[2]
      );
      generateCSV(
        ["S.No", "Component A", "Component B", "Overlap %"],
        sortedSimilar.map((r, i) => [i + 1, ...r]),
        "similar_components"
      );
    } else if (tabIndex === 2) {
      // Child Components
      generateCSV(
        ["Parent Component", "Child Component", "Match %", "Parent Match %"],
        getFlattenedChildren().map((child, i) => [
          child.parent,
          child.childName,
          child.match,
          child.parentMatch.toFixed(2),
        ]),
        "child_components"
      );
    }
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
      data: [...report.similar].sort((a, b) =>
        similarSortOrder === "asc" ? a[2] - b[2] : b[2] - a[2]
      ),
      columns: ["S.No", "Component A", "Component B", "Overlap %"],
      message: "No Similar Components Found",
      type: "similar",
    },
    {
      label: "Child Components",
      data: getFlattenedChildren(),
      columns: ["Parent Component", "Child Component", "Match %", "Parent Match %"],
      message: "No Child Components Found",
      type: "children",
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Storyblok Component Analyzer
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
              gap: 2,
            }}
          >
            <Tabs
              value={tabIndex}
              onChange={(_, v) => setTabIndex(v)}
              textColor="primary"
              indicatorColor="primary"
            >
              {tabs.map((t, i) => (
                <Tab key={i} label={t.label} />
              ))}
            </Tabs>
            <Box display="flex" gap={2}>
              {tabIndex === 1 && (
                <Button variant="outlined" onClick={toggleSimilarSortOrder}>
                  Sort: {similarSortOrder === "asc" ? "↑ Ascending" : "↓ Descending"}
                </Button>
              )}
              {tabIndex === 2 && (
                <Button variant="outlined" onClick={toggleChildSortOrder}>
                  Sort: {childSortOrder === "asc" ? "↑ Ascending" : "↓ Descending"}
                </Button>
              )}
              <Button variant="contained" onClick={handleDownload}>
                Export CSV
              </Button>
            </Box>
          </Box>

          {tabs.map((tab, index) =>
            tabIndex === index ? (
              <Box key={index}>
                {tab.data.length === 0 ? (
                  <Typography variant="body1">{tab.message}</Typography>
                ) : (
                  <>
                    <Table>
                      <TableHead>
                        <TableRow>
                          {tab.type === "children" && <TableCell>S.No</TableCell>}
                          {tab.columns.map((col, i) => (
                            <TableCell key={i}>{col}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tab.type === "children"
                          ? paginated(tab.data, "children").map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  {index + 1 + (page.children - 1) * ITEMS_PER_PAGE}
                                </TableCell>
                                <TableCell>{item.parent}</TableCell>
                                <TableCell>{item.childName}</TableCell>
                                <TableCell>{item.match}%</TableCell>
                                <TableCell>{item.parentMatch.toFixed(2)}%</TableCell>
                              </TableRow>
                            ))
                          : paginated(tab.data, tab.type).map((row, i) => (
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
            ) : null
          )}

          <Box sx={{ mt: 4 }}>
            <Typography variant="h6">Logs</Typography>
            {log.map((line, i) => (
              <Typography key={i} variant="body2">
                {line}
              </Typography>
            ))}
          </Box>
        </>
      )}
    </Container>
  );
};

export default Analyzer;
