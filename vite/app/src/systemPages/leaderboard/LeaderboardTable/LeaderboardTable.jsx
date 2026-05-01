
import React, { useState } from "react";
import useFetchData from "@/hooks/useFetchData";

import { Box, LinearProgress, Typography } from "@mui/material";


const StudentsLeaderboard = () => {
  const { data, loadingData } = useFetchData("/api/leaderboard", 5);

  const [showLastMonthOnly, setShowLastMonthOnly] = useState(true);

  const filteredRows = data.filter((row) => {
    if (!showLastMonthOnly) return true;
    const now = new Date();
    const oneDayAgo = new Date(now.setDate(now.getDate() - 1));
    return new Date(row.lastseen) >= oneDayAgo;
  });

  filteredRows.sort((a, b) => b.testgrade - a.testgrade);

  return (
    <div className="p-5 font-sans">
      <h2 className="mb-2.5 text-gray-700">Fišingo Atakų Atpažinimo Lyderiai</h2>

      <div className="flex items-center justify-between mb-2.5">
        <div className="text-sm text-gray-400">
          {loadingData ? "Kraunama..." : "Automatiškai atnaujinama kas 5s"}
        </div>
        <label className="inline-flex items-center text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mr-2"
            checked={!showLastMonthOnly}
            onChange={(e) => setShowLastMonthOnly(!e.target.checked)}
          />
          Rodyti Visus
        </label>
      </div>

      {loadingData && <div className="mb-2.5 font-bold text-[#E64164]">Kraunama...</div>}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed shadow-sm">
          <colgroup>
            <col style={{ width: "5%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "40%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>

          <thead>
            <tr>
              <th className="bg-[#f2f2f2] text-left font-semibold p-2 border-b-2 border-[#ddd]">ID</th>
              <th className="bg-[#f2f2f2] text-left font-semibold p-2 border-b-2 border-[#ddd]">Vardas</th>
              <th className="bg-[#f2f2f2] text-center font-semibold p-2 border-b-2 border-[#ddd]">Įvertinimas / Progresas</th>
              <th className="bg-[#f2f2f2] text-center font-semibold p-2 border-b-2 border-[#ddd]">Paskutinįkart Pastebėtas</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => {
              const progressValue = row.isfinished ? 100 : Math.round((row.answeredquestioncount / row.questioncount) * 100);

              return (
                <tr key={row.id} className="bg-white cursor-pointer hover:bg-[#fafafa]">
                  <td className="p-2 border-b border-[#ddd]">{row.id}</td>
                  <td className="p-2 border-b border-[#ddd]">{row.username}</td>
                  <td className="p-2 border-b border-[#ddd]">
                    <Box sx={{ width: "100%", position: "relative" }}>
                      <LinearProgress
                        variant="determinate"
                        value={row.isfinished === 1 ? 100 : progressValue}
                        sx={{
                          height: 32,
                          borderRadius: "10px",
                          backgroundColor: "rgba(0,0,0,0.1)",
                          "& .MuiLinearProgress-bar": {
                            backgroundColor: row.isfinished === 1 ? "primary.main" : "blue",
                            borderRadius: "10px",
                          },
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          position: "absolute",
                          fontWeight: "bold",
                          color: row.isfinished === 1 ? "white" : "black",
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
                          pointerEvents: "none",
                        }}
                      >
                        {row.isfinished === 1
                          ? `Įvertinimas: ${row.testgrade}`
                          : `${row.answeredquestioncount} / ${row.questioncount}`
                        }
                      </Typography>
                    </Box>
                  </td>
                  <td className="p-2 border-b border-[#ddd] text-center">{row.lastseen}</td>
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
