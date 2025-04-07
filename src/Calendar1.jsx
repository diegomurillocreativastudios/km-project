import React, { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import _ from 'lodash';
import './Calendar1.css';

/* ============================================================
   Utility & Helper Functions
   ============================================================ */

// Generate sparkline data based on a given month and calendar data.
const generateSparklineData = (month, calendarData) => {
  const currentDate = new Date(month + '-01');
  const futureData = [];
  for (let i = 1; i <= 6; i++) {
    const futureDate = new Date(currentDate);
    futureDate.setMonth(currentDate.getMonth() + i);
    const futureKey = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;
    const futureMonth = calendarData.find(m => m.month === futureKey);
    futureData.push(futureMonth ? futureMonth.total : 0);
  }
  return futureData;
};

// Return a pastel color for a given provider.
const getProviderColor = (() => {
  const baseColors = [
    '#F4A7A7', '#A7C3F4', '#B8F4A7', '#F4B27A', '#A7F4C3',
    '#F4D27A', '#B8A7F4', '#A7F4D8', '#F4A7F4', '#F4E47A',
    '#A7F4B8', '#D8A7F4', '#F4A7D8', '#C3D8A7', '#F4A7B8',
    '#A7E4F4', '#F4A7C3', '#E4B8F4', '#F4E4A7', '#D8B8A7',
    '#A7A7F4', '#C3A7F4', '#E4F47A', '#D8D8D8'
  ];
  const colorCache = new Map();
  let currentProviderList = [];
  return (provider) => {
    if (!provider) return '#D8D8D8';
    if (!colorCache.has(provider)) {
      if (!currentProviderList.includes(provider)) {
        currentProviderList.push(provider);
        const colorIndex = currentProviderList.length - 1;
        colorCache.set(provider, baseColors[colorIndex % baseColors.length]);
      }
    }
    return colorCache.get(provider) || '#D8D8D8';
  };
})();

// Returns a color from a gradient based on payment amount.
const getPaymentColor = (amount, max) => {
  const ratio = max ? amount / max : 0;
  if (ratio < 0.3) return '#e0f2f1';
  if (ratio < 0.6) return '#b2dfdb';
  if (ratio < 0.75) return '#80cbc4';
  if (ratio < 0.9) return '#4db6ac';
  return '#00897b';
};

// Format month key (YYYY-MM) into a human-readable string.
const formatMonth = (monthKey) => {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

/* ============================================================
   Calendar1 Component
   ============================================================ */

const Calendar1 = () => {
  /* --------------------------
     State Variables
     -------------------------- */
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState(null);

  // Filters
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [agreementTypes, setAgreementTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('all');
  const [subTypes, setSubTypes] = useState([]);
  const [selectedSubType, setSelectedSubType] = useState('all');
  const [statuses, setStatuses] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Month and Chart selection
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [chartKey, setChartKey] = useState(0);

  // Contract hover data and ref for contracts list
  const [contractHoverData, setContractHoverData] = useState(null);
  const contractListRef = useRef(null);

  /* ============================================================
     CSV Handling Functions
     ============================================================ */

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  const processData = (data) => {
    const agreementData = data
      .filter(row => row['Agreement Date'] && row['Recurring Monthly Charges'])
      .map(row => {
        let charges = 0;
        if (row['Recurring Monthly Charges']) {
          const chargeStr = String(row['Recurring Monthly Charges']).replace(/[$,]/g, '');
          charges = parseFloat(chargeStr);
        }
        return {
          agreementName: row['Agreement Name'],
          provider: row['Party1 Name'],
          date: new Date(row['Agreement Date']),
          term: row['Term'] || 36,
          monthlyCharges: isNaN(charges) ? 0 : charges,
          subType: row['Sub Type'] || 'N/A',
          status: row['Status'] || 'N/A',
          type: row['Contract Type'] || 'N/A',
          connectionServices: row['Connection Services'] || []
        };
      })
      .filter(item => !isNaN(item.date.getTime()) && item.monthlyCharges > 0);

    const months = {};
    agreementData.forEach(agreement => {
      const startDate = new Date(agreement.date);
      const endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + parseInt(agreement.term));
      let currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        if (!months[monthKey]) {
          months[monthKey] = {
            agreements: [],
            total: 0,
            startDates: [],
            endDates: [],
            providers: {},
          };
        }

        const providerName = agreement.provider || 'Unknown';
        if (!months[monthKey].providers[providerName]) {
          months[monthKey].providers[providerName] = 0;
        }
        months[monthKey].providers[providerName] += agreement.monthlyCharges;
        months[monthKey].total += agreement.monthlyCharges;

        const exists = months[monthKey].agreements.some(a => a.name === agreement.agreementName);
        if (!exists) {
          months[monthKey].agreements.push({
            name: agreement.agreementName,
            provider: agreement.provider,
            amount: agreement.monthlyCharges,
            term: agreement.term,
            startDate: startDate,
            endDate: endDate,
            type: agreement.type,
            subType: agreement.subType,
            status: agreement.status,
            connectionServices: agreement.connectionServices
          });
        }

        const isStartMonth =
          currentDate.getMonth() === startDate.getMonth() &&
          currentDate.getFullYear() === startDate.getFullYear();
        const isEndMonth =
          currentDate.getMonth() === endDate.getMonth() &&
          currentDate.getFullYear() === endDate.getFullYear();

        if (isStartMonth) {
          months[monthKey].startDates.push({
            name: agreement.agreementName,
            provider: agreement.provider,
            day: startDate.getDate(),
            amount: agreement.monthlyCharges,
          });
        }

        if (isEndMonth) {
          months[monthKey].endDates.push({
            name: agreement.agreementName,
            provider: agreement.provider,
            day: endDate.getDate(),
            amount: agreement.monthlyCharges,
          });
        }
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    });

    const sortedMonths = Object.keys(months)
      .sort()
      .map(key => ({ month: key, ...months[key] }));
    const uniqueYears = [...new Set(sortedMonths.map(m => m.month.split('-')[0]))].sort();
    setYears(uniqueYears);
    setCalendarData(sortedMonths);
  };

  const processCSV = useCallback((fileContent) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        processData(results.data);
        setLoading(false);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        setLoading(false);
      },
    });
  }, []);

  /* ============================================================
     Filtering and Summary Calculations
     ============================================================ */

  // Define filtering callback.
  const getFilteredData = useCallback(
    (data) => {
      return data.map((month) => {
        const filteredAgreements = month.agreements.filter((a) => {
          const matchProvider = selectedProvider === 'all' || a.provider === selectedProvider;
          const matchType = selectedType === 'all' || a.type === selectedType;
          const matchSubType = selectedSubType === 'all' || a.subType === selectedSubType;
          const matchStatus = selectedStatus === 'all' || a.status === selectedStatus;
          return matchProvider && matchType && matchSubType && matchStatus;
        });
        const filteredProviders = {};
        let filteredTotal = 0;
        filteredAgreements.forEach((agreement) => {
          filteredProviders[agreement.provider] = (filteredProviders[agreement.provider] || 0) + agreement.amount;
          filteredTotal += agreement.amount;
        });
        const filteredStart = month.startDates.filter(evt => selectedProvider === 'all' || evt.provider === selectedProvider);
        const filteredEnd = month.endDates.filter(evt => selectedProvider === 'all' || evt.provider === selectedProvider);
        return {
          ...month,
          agreements: filteredAgreements,
          providers: filteredProviders,
          total: filteredTotal,
          startDates: filteredStart,
          endDates: filteredEnd,
        };
      });
    },
    [selectedProvider, selectedType, selectedSubType, selectedStatus]
  );

  // Apply year filter and get filtered data.
  const yearFilteredData = calendarData.filter(m => !selectedYear || m.month.startsWith(selectedYear));
  const filteredData = getFilteredData(yearFilteredData);

  // Summary calculations.
  const totalSpent = filteredData.reduce((acc, m) => acc + m.total, 0);
  const activeAgreementsSet = new Set();
  filteredData.forEach(m => m.agreements.forEach(a => activeAgreementsSet.add(a.name)));
  const activeContracts = activeAgreementsSet.size;

  let yearGrowth = 0;
  if (selectedYear && years.length > 1) {
    const currentYearIndex = years.indexOf(selectedYear);
    if (currentYearIndex > 0) {
      const previousYear = years[currentYearIndex - 1];
      const prevData = calendarData.filter(m => m.month.startsWith(previousYear));
      const prevTotal = prevData.reduce((acc, x) => acc + x.total, 0);
      if (prevTotal !== 0) {
        yearGrowth = ((totalSpent - prevTotal) / prevTotal) * 100;
      }
    }
  }

  let topProvider = null;
  if (filteredData.length > 0) {
    const providerTotals = {};
    filteredData.forEach(m => {
      Object.entries(m.providers).forEach(([p, amt]) => {
        providerTotals[p] = (providerTotals[p] || 0) + amt;
      });
    });
    Object.entries(providerTotals).forEach(([p, amt]) => {
      if (amt > (providerTotals[topProvider] || 0)) topProvider = p;
    });
  }

  const maxPayment = Math.max(...filteredData.map(m => m.total), 0);

  /* ============================================================
     useEffect Hooks
     ============================================================ */

  // Load CSV file or fetch default data.
  useEffect(() => {
    if (csvFile) {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => processCSV(e.target.result);
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        setLoading(false);
      };
      reader.readAsText(csvFile);
    } else {
      setLoading(true);
      fetch('/data/Acorn Health.csv')
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response.text();
        })
        .then((fileContent) => processCSV(fileContent))
        .catch((fetchError) => {
          console.error('Error fetching default CSV:', fetchError);
          setLoading(false);
        });
    }
  }, [csvFile, processCSV]);

  // Handle window resizing to force chart re-render.
  useEffect(() => {
    const handleResize = _.debounce(() => {
      setChartKey(prev => prev + 1);
    }, 250);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Build filter lists from calendar data.
  useEffect(() => {
    if (calendarData.length > 0) {
      const uniqueProviders = [...new Set(calendarData.flatMap(m => m.agreements.map(a => a.provider)))].sort();
      setProviders(uniqueProviders);
      const uniqueTypes = [...new Set(calendarData.flatMap(m => m.agreements.map(a => a.type || 'Unknown')))].sort();
      setAgreementTypes(uniqueTypes);
      const uniqueSubTypes = [...new Set(calendarData.flatMap(m => m.agreements.map(a => a.subType || 'N/A')))].sort();
      setSubTypes(uniqueSubTypes);
      const uniqueStatuses = [...new Set(calendarData.flatMap(m => m.agreements.map(a => a.status || 'N/A')))].sort();
      setStatuses(uniqueStatuses);
    }
  }, [calendarData]);

  // Set default selected year if none is selected.
  useEffect(() => {
    if (!selectedYear && years.length) {
      const currentYear = new Date().getFullYear().toString();
      setSelectedYear(years.includes(currentYear) ? currentYear : years[years.length - 1]);
    }
  }, [selectedYear, years]);

  // Set default selected month if none is selected.
  useEffect(() => {
    if (filteredData.length && !selectedMonth) {
      const monthsInYear = filteredData.map(m => m.month).sort();
      if (monthsInYear.length) {
        setSelectedMonth(monthsInYear[monthsInYear.length - 1]);
      }
    }
  }, [filteredData, selectedMonth]);

  /* ============================================================
     Event Handlers
     ============================================================ */

  const handleMonthClick = (monthKey) => {
    setSelectedMonth(prev => (prev === monthKey ? null : monthKey));
  };

  const handleContractMouseEnter = (e, agreement) => {
    if (contractListRef.current) {
      const rect = contractListRef.current.getBoundingClientRect();
      setContractHoverData({
        agreement,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleContractMouseMove = (e, agreement) => {
    if (contractListRef.current) {
      const rect = contractListRef.current.getBoundingClientRect();
      setContractHoverData({
        agreement,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleContractMouseLeave = () => {
    setContractHoverData(null);
  };

  /* ============================================================
     Rendering Functions
     ============================================================ */

  const renderYearlyStackedBar = () => {
    if (!filteredData.length) return null;
    const containerWidth = document.querySelector('.chart-container')?.clientWidth ?? 800;
    const margins = 40;
    const availableWidth = containerWidth - margins;
    const monthCount = filteredData.length;
    const minBarWidth = 40;
    const gap = 10;
    const chartHeight = 200;
    const barWidth = Math.max(minBarWidth, (availableWidth / monthCount) - gap);

    const monthsInYear = [...filteredData].sort(
      (a, b) => new Date(a.month + '-01') - new Date(b.month + '-01')
    );
    const maxTotal = Math.max(...monthsInYear.map(m => m.total), 0);
    if (maxTotal === 0) return null;

    const providersSet = new Set();
    monthsInYear.forEach(m => Object.keys(m.providers).forEach(p => providersSet.add(p)));
    const providersList = Array.from(providersSet).sort();

    return (
      <svg
        viewBox={`0 0 ${(barWidth + gap) * monthsInYear.length} ${chartHeight + 30}`}
        preserveAspectRatio="xMidYMid meet"
        className="stacked-bar-chart-svg"
      >
        {monthsInYear.map((monthData, index) => {
          let cumulativeHeight = 0;
          return (
            <g key={monthData.month} transform={`translate(${index * (barWidth + gap)}, 0)`}>
              {providersList.map((provider) => {
                const amount = monthData.providers[provider] || 0;
                const segmentHeight = (amount / maxTotal) * chartHeight;
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
              <text
                x={barWidth / 2}
                y={chartHeight + 15}
                textAnchor="middle"
                fontSize="10"
                fill="#333"
              >
                {new Date(monthData.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  /* ============================================================
     Main Render
     ============================================================ */

  if (loading) {
    return <div className="loading">Loading data...</div>;
  }

  return (
    <div className="calendar1">
      {/* Top Summary Bar */}
      <div className="top-summary-bar">
        <div className="summary-section">
          <div className="summary-card">
            <div className="summary-label">Total</div>
            <div className="summary-value">
              ${totalSpent.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Active Contracts</div>
            <div className="summary-value">{activeContracts}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Revenue YOY</div>
            <div className={`summary-value ${yearGrowth >= 0 ? 'positive' : 'negative'}`}>
              {yearGrowth >= 0 ? `+${yearGrowth.toFixed(1)}%` : `${yearGrowth.toFixed(1)}%`}
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Top Provider</div>
            <div className="summary-value">{topProvider || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Layout Container */}
      <div className="layout-container">
        {/* Sidebar: Filters & CSV Uploader */}
        <div className="sidebar">
          <h2>Filters</h2>
          <div className="file-uploader">
            <label htmlFor="csvUpload">Upload CSV File</label>
            <input type="file" id="csvUpload" accept=".csv" onChange={handleFileChange} />
            {csvFile && <span className="file-name">{csvFile.name}</span>}
          </div>
          <div className="filter-group">
            <label>Select Year</label>
            <select
              className="filter-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">--All--</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Provider</label>
            <select
              className="filter-select"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
            >
              <option value="all">All Providers</option>
              {providers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Contract Type</label>
            <select
              className="filter-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">All Types</option>
              {agreementTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Sub Type</label>
            <select
              className="filter-select"
              value={selectedSubType}
              onChange={(e) => setSelectedSubType(e.target.value)}
            >
              <option value="all">All Sub Types</option>
              {subTypes.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select
              className="filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="main-content">
          <h2>Payment Timeline</h2>
          <div className="chart-container">
            <h3 className="chart-title">
              {selectedYear || 'All Years'} Monthly Payments by Provider
            </h3>
            <div key={chartKey}>
              {renderYearlyStackedBar()}
            </div>
          </div>

          {/* Monthly Breakdown Cards */}
          <div className="month-timeline-container">
            <h3 className="month-timeline-title">Monthly Breakdown</h3>
            <div className="month-cards-row">
              {filteredData.map((month) => (
                <div
                  key={month.month}
                  className={`month-card ${selectedMonth === month.month ? 'selected' : ''}`}
                  style={{ backgroundColor: getPaymentColor(month.total, maxPayment) }}
                  onClick={() => handleMonthClick(month.month)}
                >
                  <div className="month-header">
                    <h3>{formatMonth(month.month)}</h3>
                    <div className="month-total">
                      ${month.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Mini Stacked Bar */}
                  <div className="mini-stacked-bar">
                    {Object.entries(month.providers)
                      .sort((a, b) => b[1] - a[1])
                      .map(([provider, amt]) => {
                        const ratio = month.total ? (amt / month.total) * 100 : 0;
                        return (
                          <div
                            key={provider}
                            className="provider-segment"
                            style={{
                              width: `${ratio}%`,
                              backgroundColor: getProviderColor(provider),
                            }}
                          ></div>
                        );
                      })}
                  </div>

                  {/* Sparkline */}
                  <div className="sparkline-container">
                    <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
                      {generateSparklineData(month.month, calendarData).map((value, index, array) => {
                        const x = (index / (array.length - 1)) * 100;
                        const y = 30 - ((value / Math.max(...array)) * 25);
                        return index === 0 ? (
                          <path
                            key="sparkline-path"
                            d={`M ${x} ${y} ${array.map((v, i) => {
                              const pointX = (i / (array.length - 1)) * 100;
                              const pointY = 30 - ((v / Math.max(...array)) * 25);
                              return `L ${pointX} ${pointY}`;
                            }).join(' ')}`}
                            fill="none"
                            stroke="#2196F3"
                            strokeWidth="1.5"
                          />
                        ) : null;
                      })}
                    </svg>
                  </div>

                  {/* Contract Badges */}
                  <div className="contract-badges">
                    {month.startDates.length > 0 && (
                      <span className="badge badge-new">
                        <span className="badge-icon">+</span>
                        {month.startDates.length}
                      </span>
                    )}
                    {month.endDates.length > 0 && (
                      <span className="badge badge-ending">
                        <span className="badge-icon">-</span>
                        {month.endDates.length}
                      </span>
                    )}
                  </div>

                  {/* Provider Bars */}
                  <div className="provider-bars">
                    {Object.entries(month.providers)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([provider, amount]) => (
                        <div key={provider} className="provider-bar-container">
                          <div className="provider-label">
                            <span className="provider-color" style={{ backgroundColor: getProviderColor(provider) }}></span>
                            <span className="provider-name">{provider}</span>
                          </div>
                          <div className="provider-amount">
                            ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Month View */}
          {selectedMonth && (
            <div className="month-details">
              <h3>Details for {formatMonth(selectedMonth)}</h3>
              {filteredData.filter(m => m.month === selectedMonth).map((month) => (
                <div key={month.month} className="detail-container">
                  <div>
                    {month.startDates.length > 0 && (
                      <div className="event-section">
                        <h4>New Contracts ({month.startDates.length})</h4>
                        <ul className="event-list">
                          {month.startDates.map((event, idx) => (
                            <li key={`start-${idx}`} className="event-item">
                              <div className="event-marker" style={{ backgroundColor: getProviderColor(event.provider) }}></div>
                              <div className="event-date">Day {event.day}</div>
                              <div>
                                <div className="event-name">{event.name}</div>
                                <div className="event-provider">{event.provider}</div>
                                <div className="event-amount">
                                  ${event.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}/month
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {month.endDates.length > 0 && (
                      <div className="event-section">
                        <h4>Ending Contracts ({month.endDates.length})</h4>
                        <ul className="event-list">
                          {month.endDates.map((event, idx) => (
                            <li key={`end-${idx}`} className="event-item">
                              <div className="event-marker" style={{ backgroundColor: getProviderColor(event.provider) }}></div>
                              <div className="event-date">Day {event.day}</div>
                              <div>
                                <div className="event-name">{event.name}</div>
                                <div className="event-provider">{event.provider}</div>
                                <div className="event-amount">
                                  ${event.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}/month
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="agreements-section" ref={contractListRef}>
                    <h4>Active Agreements ({month.agreements.length})</h4>
                    {Object.entries(_.groupBy(month.agreements, 'provider'))
                      .sort((a, b) => (month.providers[b[0]] || 0) - (month.providers[a[0]] || 0))
                      .map(([provider, providerAgreements]) => {
                        const totalForProvider = month.providers[provider] || 0;
                        const percentage = month.total ? (totalForProvider / month.total) * 100 : 0;
                        return (
                          <div key={provider} className="provider-agreements-item">
                            <div className="provider-summary-item">
                              <div className="provider-color-block" style={{ backgroundColor: getProviderColor(provider) }}></div>
                              <div className="provider-summary-name">{provider}</div>
                              <div className="provider-summary-amount">
                                ${totalForProvider.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </div>
                              <div className="provider-summary-percent">{percentage.toFixed(1)}%</div>
                            </div>
                            <div className="provider-agreements-list">
                              {providerAgreements.sort((a, b) => b.amount - a.amount).map((agreement, idx) => (
                                <div
                                  key={idx}
                                  className="agreement-item"
                                  onMouseEnter={(e) => handleContractMouseEnter(e, agreement)}
                                  onMouseMove={(e) => handleContractMouseMove(e, agreement)}
                                  onMouseLeave={handleContractMouseLeave}
                                >
                                  <div className="agreement-main">
                                    <div className="agreement-color" style={{ backgroundColor: getProviderColor(provider) }}></div>
                                    <div className="agreement-name">{agreement.name}</div>
                                    <div className="agreement-amount">
                                      ${agreement.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                  {agreement.connectionServices && agreement.connectionServices.length > 0 && (
                                    <div className="agreement-services">
                                      Services: {Array.isArray(agreement.connectionServices)
                                        ? agreement.connectionServices.join(', ')
                                        : agreement.connectionServices}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    {contractHoverData && (
                      <div
                        className="contract-hover-card"
                        style={{
                          left: `${contractHoverData.x + 10}px`,
                          top: `${contractHoverData.y + 10}px`,
                        }}
                      >
                        <div className="hover-card-title">{contractHoverData.agreement.name}</div>
                        <div>Provider: {contractHoverData.agreement.provider}</div>
                        <div>
                          Monthly Charge: $
                          {contractHoverData.agreement.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <div>Term: {contractHoverData.agreement.term} months</div>
                        <div>
                          Start: {new Date(contractHoverData.agreement.startDate).toLocaleDateString()}
                        </div>
                        <div>
                          End: {new Date(contractHoverData.agreement.endDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar1;