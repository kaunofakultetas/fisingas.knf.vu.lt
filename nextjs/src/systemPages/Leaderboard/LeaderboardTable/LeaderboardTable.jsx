'use client';
import React, { useState, useEffect } from "react";
import axios from "axios";

// MUI Joy
import Box from "@mui/joy/Box";
import LinearProgress from "@mui/joy/LinearProgress";
import Typography from "@mui/joy/Typography";

// ---------------- Inline Styles ----------------
const containerStyle = {
  padding: "20px",
  fontFamily: "Arial, sans-serif",
};

const titleStyle = {
  marginBottom: "10px",
  color: "#333",
};

const topBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "10px",
};

const refreshInfoStyle = {
  fontSize: "14px",
  color: "#999",
};

const lastMonthToggleStyle = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: "14px",
  cursor: "pointer",
};

const checkboxStyle = {
  marginRight: "8px",
};

const loadingStyle = {
  marginBottom: "10px",
  fontWeight: "bold",
  color: "#E64164",
};

const tableWrapperStyle = {
  overflowX: "auto", // in case the table is too wide on smaller screens
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed", // Fixes column widths
  boxShadow: "0 0 5px rgba(0, 0, 0, 0.1)",
};

const thStyle = {
  backgroundColor: "#f2f2f2",
  textAlign: "left",
  fontWeight: "600",
  padding: "8px",
  borderBottom: "2px solid #ddd",
};

const tdStyle = {
  padding: "8px",
  borderBottom: "1px solid #ddd",
};

const rowStyle = {
  backgroundColor: "white",
  cursor: "pointer",
};



// ---------------- Component ----------------
const StudentsLeaderboard = () => {
  const [data, setData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [showLastMonthOnly, setShowLastMonthOnly] = useState(true);

  const REFRESH_TIME = 5; // seconds
  const [nextUpdate, setNextUpdate] = useState(REFRESH_TIME);

  // Fetch data and refresh periodically
  useEffect(() => {
    let updateTimer;

    async function getData() {
      try {
        const response = await axios.get("/api/leaderboard");
        setData(response.data);
        setLoadingData(false);
      } catch (error) {
        if (error?.response?.status === 401) {
          window.location.href = "/login";
        }
      }
    }

    getData(); // initial fetch

    // Update countdown each second; refetch when it hits 0
    const updateCount = () => {
      updateTimer = setInterval(() => {
        setNextUpdate((prevTime) => {
          if (prevTime <= 1) {
            getData();
            return REFRESH_TIME; // reset
          }
          return prevTime - 1;
        });
      }, 1000);
    };
    updateCount();

    return () => clearInterval(updateTimer);
  }, []);

  // Filter out students last seen over a day ago if toggled
  const filteredRows = data.filter((row) => {
    if (!showLastMonthOnly) {
      return true; // Show all users when unchecked
    }
    const now = new Date();
    const oneDayAgo = new Date(now.setDate(now.getDate() - 1));
    const rowLastSeen = new Date(row.lastseen);
    return rowLastSeen >= oneDayAgo; // Show only users from the last day when checked
  });

  // Sort descending by test score
  filteredRows.sort((a, b) => b.testgrade - a.testgrade);

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Fišingo Atakų Atpažinimo Lyderiai</h2>

      {/* Top bar: countdown + toggle */}
      <div style={topBarStyle}>
        <div style={refreshInfoStyle}>
          {loadingData ? "Kraunama..." : `Atnaujinimas po: ${nextUpdate}s`}
        </div>
        <label style={lastMonthToggleStyle}>
          <input
            type="checkbox"
            style={checkboxStyle}
            checked={!showLastMonthOnly}
            onChange={(e) => setShowLastMonthOnly(!e.target.checked)}
          />
          Rodyti Visus
        </label>
      </div>

      {/* Loading indicator */}
      {loadingData && <div style={loadingStyle}>Kraunama...</div>}

      {/* Table with fixed layout & colgroup for consistent widths */}
      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <colgroup>
            {/* ID - 5% */}
            <col style={{ width: "5%" }} />
            {/* Username - 15% */}
            <col style={{ width: "15%" }} />
            {/* QCount/Progress - 40% */}
            {/* Score - 20% */}
            <col style={{ width: "40%" }} />
            {/* LastSeen - 20% */}
            <col style={{ width: "20%" }} />
          </colgroup>

          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Vardas</th>
              <th style={{ textAlign: 'center', backgroundColor: "#f2f2f2" }}>Įvertinimas / Progresas</th>
              <th style={{ textAlign: 'center', backgroundColor: "#f2f2f2" }}>Paskutinįkart Pastebėtas</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => {
              const progressValue = row.isfinished ? 100 : Math.round((row.answeredquestioncount / row.questioncount) * 100);

              return (
                <tr
                  key={row.id}
                  style={rowStyle}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#fafafa"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                >
                  <td style={tdStyle}>{row.id}</td>
                  <td style={tdStyle}>{row.username}</td>
                  <td style={tdStyle}>
                    <Box sx={{ width: "100%" }}>
                      <LinearProgress
                        determinate
                        variant="outlined"
                        size="sm"
                        thickness={32}
                        value={row.isfinished === 1 ? 100 : progressValue}
                        sx={{
                          width: "100%",
                          "--LinearProgress-radius": "10px",
                          "--LinearProgress-progressThickness": "24px",
                          boxShadow: "sm",
                          color: row.isfinished === 1 ? "rgb(123, 0, 63)": "blue",
                        }}
                      >
                        <Typography
                          level="body-xs"
                          fontWeight="xl"
                          sx={{
                            position: "absolute",
                            color: "#000000",
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                            pointerEvents: "none",
                          }}
                        >
                          {row.isfinished === 1 ? 
                            <span style={{ color: 'white' }}>
                              Įvertinimas: {row.testgrade}
                            </span>
                          :
                            <span style={{ color: 'black' }}>
                              {row.answeredquestioncount} / {row.questioncount}
                            </span>
                          }
                        </Typography>
                      </LinearProgress>
                    </Box>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{row.lastseen}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentsLeaderboard;
