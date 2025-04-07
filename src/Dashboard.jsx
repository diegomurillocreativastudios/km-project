// Dashboard.jsx
import React, { useState, useEffect } from 'react';
import TimelineCalendar from './TimelineCalendar';
import './Dashboard.css';

const Dashboard = () => {
  // Default the selected year to current
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Store the entire timeline data after CSV parse
  const [calendarData, setCalendarData] = useState([]);

  // Summaries
  const [summaryData, setSummaryData] = useState({
    totalAnnualSpend: 0,
    activeContracts: 0,
    yearGrowth: 0,
    topProvider: { name: '', amount: 0 }
  });

  // Also store the CSV file from filter panel
  const [csvFile, setCsvFile] = useState(null);
  const [years, setYears] = useState([]);

  // Whenever CSV data is processed in TimelineCalendar, we get it here
  const handleCalendarDataUpdate = (allMonths) => {
    setCalendarData(allMonths);
  };

  // Recompute summary cards whenever data or selectedYear changes
  useEffect(() => {
    if (!calendarData.length || !selectedYear) {
      return;
    }
    // Filter months for the selected year
    const yearMonths = calendarData.filter(m => m.month.startsWith(selectedYear));
    if (!yearMonths.length) {
      setSummaryData({
        totalAnnualSpend: 0,
        activeContracts: 0,
        yearGrowth: 0,
        topProvider: { name: '', amount: 0 }
      });
      return;
    }

    // 1) Total Annual Spend
    const totalAnnualSpend = yearMonths.reduce((sum, m) => sum + m.total, 0);

    // 2) Active Contracts: distinct agreements across the year
    const distinctAgreements = new Set();
    yearMonths.forEach(m => {
      m.agreements.forEach(a => distinctAgreements.add(a.name));
    });
    const activeContracts = distinctAgreements.size;

    // 3) Year Growth: compare to previous year’s total
    const prevYear = (parseInt(selectedYear, 10) - 1).toString();
    const prevYearMonths = calendarData.filter(m => m.month.startsWith(prevYear));
    const prevYearTotal = prevYearMonths.reduce((sum, m) => sum + m.total, 0);
    let yearGrowth = 0;
    if (prevYearTotal > 0) {
      yearGrowth = ((totalAnnualSpend - prevYearTotal) / prevYearTotal) * 100;
    }

    // 4) Top Provider for that year
    const providerTotals = {};
    yearMonths.forEach(m => {
      Object.entries(m.providers).forEach(([prov, amt]) => {
        if (!providerTotals[prov]) providerTotals[prov] = 0;
        providerTotals[prov] += amt;
      });
    });
    let topProvider = { name: '', amount: 0 };
    Object.entries(providerTotals).forEach(([prov, amt]) => {
      if (amt > topProvider.amount) {
        topProvider = { name: prov, amount: amt };
      }
    });

    setSummaryData({
      totalAnnualSpend,
      activeContracts,
      yearGrowth: Number(yearGrowth.toFixed(1)), // e.g. round to 1 decimal
      topProvider
    });
  }, [calendarData, selectedYear]);

  // Handler for CSV file upload
  const handleFileUpload = (e) => {
    if (e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="logo">
          <h1>Contract-Invoice-Payment</h1>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline">Export</button>
          <button className="btn btn-primary">+ New Contract</button>
        </div>
      </header>

      {/* Summary Cards (now dynamic) */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-card-title">Total Annual Spend</div>
          <div className="summary-card-value">
            ${summaryData.totalAnnualSpend.toLocaleString()}
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-card-title">Active Contracts</div>
          <div className="summary-card-value">
            {summaryData.activeContracts}
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-card-title">YoY Growth</div>
          <div className="summary-card-value">
            <span className={summaryData.yearGrowth >= 0 ? 'positive' : 'negative'}>
              {summaryData.yearGrowth >= 0 ? '+' : ''}
              {summaryData.yearGrowth}%
            </span>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-card-title">Top Provider</div>
          <div className="summary-card-value">
            <div>{summaryData.topProvider.name}</div>
            <div className="secondary-text">
              ${summaryData.topProvider.amount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="dashboard-content">
        <div className="dashboard-main">
          {/* Filter Panel */}
          <div className="filter-panel">
            <h3>Filters</h3>

            {/* CSV File Uploader */}
            <div className="filter-group">
              <label>Upload CSV File</label>
              <input type="file" accept=".csv" onChange={handleFileUpload} />
            </div>

            {/* Year Selector (default: currentYear) */}
            <div className="filter-group">
              <label>Select Year</label>
              <div className="year-buttons">
                {years.map(year => (
                  <button
                    key={year}
                    className={`year-button ${selectedYear === year ? 'active' : ''}`}
                    onClick={() => setSelectedYear(year)}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional filters remain the same */}
            <div className="filter-group">
              <label>Provider</label>
              <select className="filter-select">
                <option>All Providers</option>
                <option>Comcast</option>
                <option>Charter</option>
                <option>Hypercore</option>
                <option>Ten4</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Contract Type</label>
              <select className="filter-select">
                <option>All Types</option>
                <option>Internet</option>
                <option>Voice</option>
                <option>Security</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Min. Monthly Amount</label>
              <input
                type="range"
                min="0"
                max="10000"
                step="100"
                defaultValue="0"
                className="range-slider"
              />
              <div className="range-value">$0</div>
            </div>

            <button className="btn btn-outline full-width">Reset Filters</button>
          </div>

          {/* TimelineCalendar with callbacks */}
          <div className="dashboard-charts">
            <TimelineCalendar
              csvFile={csvFile}
              selectedYear={selectedYear}
              onYearsUpdate={setYears}
              onCalendarDataUpdate={handleCalendarDataUpdate}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="dashboard-footer">
        <p>Data last updated: {new Date().toLocaleDateString()}</p>
      </footer>
    </div>
  );
};

export default Dashboard;