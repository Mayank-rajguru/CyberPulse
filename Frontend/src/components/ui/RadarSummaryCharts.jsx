import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const RadarSummaryCharts = () => {
  const [data, setData] = useState({
    http_method_summary: {},
    targeted_industry_summary: {}
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await axios.get("/api/radar/layer7-summary");
        setData(res.data.data);
      } catch (err) {
        console.error("Error fetching radar summary:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  if (loading) return <p>Loading radar data...</p>;

  const httpMethodData = {
    labels: Object.keys(data.http_method_summary),
    datasets: [
      {
        label: "Layer 7 HTTP Methods (%)",
        data: Object.values(data.http_method_summary),
        backgroundColor: "rgba(54, 162, 235, 0.6)"
      }
    ]
  };

  const industryData = {
    labels: Object.keys(data.targeted_industry_summary),
    datasets: [
      {
        label: "Targeted Industries (%)",
        data: Object.values(data.targeted_industry_summary),
        backgroundColor: [
          "#FF6384",
          "#36A2EB",
          "#FFCE56",
          "#4BC0C0",
          "#9966FF"
        ]
      }
    ]
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 p-4">
      <div className="w-full md:w-1/2">
        <Bar data={httpMethodData} options={{ responsive: true }} />
      </div>
      <div className="w-full md:w-1/2">
        <Pie data={industryData} options={{ responsive: true }} />
      </div>
    </div>
  );
};

export default RadarSummaryCharts;
