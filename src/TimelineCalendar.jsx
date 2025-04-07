import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import _ from 'lodash';
import './TimelineCalendar.css';

const TimelineCalendar = ({
  csvFile,
  selectedYear,
  onYearsUpdate,
  onCalendarDataUpdate
}) => {
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const [hoverData, setHoverData] = useState(null);
  const [contractHoverData, setContractHoverData] = useState(null);
  const [chartWidth, setChartWidth] = useState(0);

  const contractListRef = useRef(null);
  const barChartRef = useRef(null);
  const chartContainerRef = useRef(null);

  useEffect(() => {
    const updateChartWidth = () => {
      if (chartContainerRef.current) {
        setChartWidth(chartContainerRef.current.clientWidth);
      }
    };
    updateChartWidth();
    window.addEventListener('resize', updateChartWidth);
    return () => window.removeEventListener('resize', updateChartWidth);
  }, []);

  // Load CSV
  useEffect(() => {
    const processCSV = (fileContent) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          processData(results.data);
          setLoading(false);
        },
        error: (error) => {
          console.error("Error parsing CSV:", error);
          setLoading(false);
        }
      });
    };

    if (csvFile) {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        processCSV(e.target.result);
      };
      reader.onerror = (err) => {
        console.error("Error reading file:", err);
        setLoading(false);
      };
      reader.readAsText(csvFile);
    } else {
      // Fallback to fetch or local
      setLoading(true);
      fetch('/data/Acorn Health.csv')
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
        })
        .then(fileContent => {
          processCSV(fileContent);
        })
        .catch(fetchError => {
          console.error("Error fetching default CSV:", fetchError);
          setLoading(false);
        });
    }
  }, [csvFile]);

  // Build internal data structure from parsed CSV
  const processData = (data) => {
    // No .sort() here—just store in a dictionary keyed by "YYYY-MM"
    const monthsDict = {};

    data.forEach(row => {
      const agreementDateStr = row['Agreement Date'];
      const monthlyStr = row['Recurring Monthly Charges'];
      if (!agreementDateStr || !monthlyStr) return;

      const dateObj = new Date(agreementDateStr);
      if (isNaN(dateObj.getTime())) return; // invalid date

      // Convert monthly charges
      let charges = 0;
      const stripped = String(monthlyStr).replace(/[$,]/g, '');
      charges = parseFloat(stripped);
      if (isNaN(charges) || charges <= 0) return;

      const provider = row['Party1 Name'] || 'Unknown';
      const agreementName = row['Agreement Name'] || 'Unnamed';
      const term = Number(row['Term'] || 36);

      // Calculate end date
      const startDate = new Date(dateObj);
      const endDate = new Date(dateObj);
      endDate.setMonth(startDate.getMonth() + term);

      // For each month from startDate to endDate:
      let current = new Date(startDate);
      while (current <= endDate) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const key = `${y}-${m}`;

        if (!monthsDict[key]) {
          monthsDict[key] = {
            month: key,
            agreements: [],
            total: 0,
            startDates: [],
            endDates: [],
            providers: {}
          };
        }
        // Add to providers total
        if (!monthsDict[key].providers[provider]) {
          monthsDict[key].providers[provider] = 0;
        }
        monthsDict[key].providers[provider] += charges;
        monthsDict[key].total += charges;

        // If the agreement is not yet in that month's "agreements" array
        if (!monthsDict[key].agreements.find(a => a.name === agreementName)) {
          monthsDict[key].agreements.push({
            name: agreementName,
            provider,
            amount: charges,
            term,
            startDate,
            endDate
          });
        }

        // Track start month
        if (
          current.getFullYear() === startDate.getFullYear() &&
          current.getMonth() === startDate.getMonth()
        ) {
          monthsDict[key].startDates.push({
            name: agreementName,
            provider,
            day: startDate.getDate(),
            amount: charges
          });
        }
        // Track end month
        if (
          current.getFullYear() === endDate.getFullYear() &&
          current.getMonth() === endDate.getMonth()
        ) {
          monthsDict[key].endDates.push({
            name: agreementName,
            provider,
            day: endDate.getDate(),
            amount: charges
          });
        }

        // Move to next month
        current.setMonth(current.getMonth() + 1);
      }
    });

    // Convert monthsDict to an array (if you want to see everything),
    // but we will not rely on that array's sort for the chart.
    const allMonthsArray = Object.values(monthsDict);
    // Optional: If you want a quick numeric sort, do:
    // allMonthsArray.sort((a, b) => {
    //   const [yearA, monthA] = a.month.split('-').map(Number);
    //   const [yearB, monthB] = b.month.split('-').map(Number);
    //   return yearA === yearB ? monthA - monthB : yearA - yearB;
    // });

    // For sparklines or similar, you can store them in each item.
    // But the main fix is to *not* rely on this array for the final chart ordering.
    setCalendarData(allMonthsArray);

    // Update year list
    const uniqueYears = Array.from(
      new Set(allMonthsArray.map(m => m.month.split('-')[0]))
    ).sort();
    onYearsUpdate?.(uniqueYears);

    // If parent wants the entire data
    onCalendarDataUpdate?.(allMonthsArray);
  };

  // Auto-select current month if present
  useEffect(() => {
    if (!calendarData.length) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const currentKey = `${y}-${m}`;
    const found = calendarData.find(x => x.month === currentKey);
    setSelectedMonth(found ? currentKey : calendarData[0].month);
  }, [calendarData]);

  // Stacked bar chart
  const renderStackedBarChart = () => {
    // Build an array of 12 months (Jan to Dec) for the selected year
    const yearToShow = selectedYear || String(new Date().getFullYear());
    const yearData = Array.from({ length: 12 }, (_, i) => {
      const monthNum = String(i + 1).padStart(2, '0');
      const key = `${yearToShow}-${monthNum}`;
      // If that month is in calendarData, use it; otherwise default
      const found = calendarData.find(m => m.month === key);
      return found || {
        month: key,
        agreements: [],
        total: 0,
        startDates: [],
        endDates: [],
        providers: {}
      };
    });

    // Dimensions
    const totalWidth = chartWidth || 800;
    const chartHeight = 200;
    const padding = 40;
    const availableWidth = totalWidth - padding;
    const barCount = yearData.length; // 12
    const barWidth = Math.max(30, Math.min(60, (availableWidth / barCount) - 10));
    const gap = Math.max(5, Math.min(10, (availableWidth - barWidth * barCount) / (barCount - 1 || 1)));

    // Max total for scaling
    const maxTotal = Math.max(...yearData.map(m => m.total), 0);

    // All providers in these 12 months
    const providersSet = new Set();
    yearData.forEach(m => {
      Object.keys(m.providers).forEach(p => providersSet.add(p));
    });
    const providersList = Array.from(providersSet).sort();

    // Hover data determines which month to show on the info-card
    const displayMonth = hoverData ? hoverData.month : yearData[yearData.length - 1];

    return (
      <div ref={barChartRef} className="chart-flex-container">
        <div className="chart-area">
          <svg
            width="100%"
            height={chartHeight + 30}
            viewBox={`0 0 ${(barWidth + gap) * barCount} ${chartHeight + 30}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {yearData.map((month, index) => {
              let cumulativeHeight = 0;
              return (
                <g
                  key={month.month}
                  transform={`translate(${index * (barWidth + gap)}, 0)`}
                  onMouseEnter={(e) => handleBarMouseEnter(e, month)}
                  onMouseMove={(e) => handleBarMouseMove(e, month)}
                  onMouseLeave={handleBarMouseLeave}
                >
                  {providersList.map(provider => {
                    const amount = month.providers[provider] || 0;
                    const segmentHeight = maxTotal > 0 ? (amount / maxTotal) * chartHeight : 0;
                    const y = chartHeight - cumulativeHeight - segmentHeight;
                    cumulativeHeight += segmentHeight;
                    return (
                      <rect
                        key={provider}
                        x={0}
                        y={y}
                        width={barWidth}
                        height={segmentHeight}
                        fill={getProviderColor(provider)}
                      />
                    );
                  })}
                  {/* X-axis label */}
                  <text
                    x={barWidth / 2}
                    y={chartHeight + 15}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#333"
                  >
                    {new Date(month.month + '-01').toLocaleString('en-US', { month: 'short' })}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Info card for hovered/last month */}
        <div className="info-card">
          <div className="info-card-title">
            {new Date(displayMonth.month + '-01').toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric'
            })}
          </div>
          <div className="info-card-content">
            {Object.entries(displayMonth.providers)
              .sort((a, b) => b[1] - a[1])
              .map(([provider, amount]) => (
                <div
                  key={provider}
                  className="info-card-item"
                  style={{ color: getProviderColor(provider) }}
                >
                  {provider}: ${amount.toLocaleString()}
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  // Handle stacked-bar hover
  const handleBarMouseEnter = (e, month) => {
    if (barChartRef.current) {
      const rect = barChartRef.current.getBoundingClientRect();
      setHoverData({
        month,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };
  const handleBarMouseMove = (e, month) => {
    if (barChartRef.current) {
      const rect = barChartRef.current.getBoundingClientRect();
      setHoverData({
        month,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };
  const handleBarMouseLeave = () => {
    setHoverData(null);
  };

  // For the month grid
  const yearFilteredData = Array.from({ length: 12 }, (_, i) => {
    const monthNum = String(i + 1).padStart(2, '0');
    const monthKey = `${selectedYear}-${monthNum}`;
    return (
      calendarData.find(m => m.month === monthKey) || {
        month: monthKey,
        agreements: [],
        total: 0,
        startDates: [],
        endDates: [],
        providers: {},
        sparkline: []
      }
    );
  });

  // Provide a color scale
  const getPaymentColor = (amount, max) => {
    const ratio = max ? amount / max : 0;
    if (ratio < 0.3) return '#e0f2f1';
    if (ratio < 0.6) return '#b2dfdb';
    if (ratio < 0.75) return '#80cbc4';
    if (ratio < 0.9) return '#4db6ac';
    return '#00897b';
  };
  const getProviderColor = (provider) => {
    if (!provider) return '#999';
    const p = provider.toLowerCase();
    if (p.includes('comcast')) return '#4285F4';
    if (p.includes('charter') || p.includes('spectrum')) return '#EA4335';
    if (p.includes('hypercore')) return '#673AB7';
    if (p.includes('cox')) return '#34A853';
    if (p.includes('ten4')) return '#FF6D01';
    if (p.includes('at&t')) return '#FFC107';
    return '#00ACC1';
  };

  // Render
  if (loading) {
    return <div className="loading">Loading data...</div>;
  }

  // Maximum monthly total for coloring the cards
  const maxPayment = Math.max(...yearFilteredData.map(m => m.total), 0);

  return (
    <div className="timeline-calendar">
      <h2>Payment Timeline</h2>

      {/* The stacked bar chart */}
      <div ref={chartContainerRef} className="chart-container">
        <h3 className="chart-title">
          {selectedYear
            ? `${selectedYear} Monthly Payments by Provider`
            : 'Monthly Payments by Provider'}
        </h3>
        {renderStackedBarChart()}
      </div>

      {/* Month Grid */}
      <div className="month-grid">
        {yearFilteredData.map(month => (
          <div
            key={month.month}
            className={`month-card ${selectedMonth === month.month ? 'selected' : ''}`}
            style={{
              backgroundColor: getPaymentColor(month.total, maxPayment),
              borderColor: selectedMonth === month.month ? '#2196F3' : 'transparent'
            }}
            onClick={() => setSelectedMonth(m => (m === month.month ? null : month.month))}
          >
            <div className="month-header">
              <h3>
                {new Date(month.month + '-01').toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                })}
              </h3>
              <div className="month-total">
                ${month.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* You can still render sparklines or markers here if you like */}
          </div>
        ))}
      </div>

      {/* Month Details for the selectedMonth, etc. */}
      {/* ... your existing details code ... */}
    </div>
  );
};

export default TimelineCalendar;