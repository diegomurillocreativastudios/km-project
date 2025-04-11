import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, FileText, TrendingUp } from 'lucide-react';
import Papa from 'papaparse';

const ImprovedMultiStatementBudget = () => {
  const [transactions, setTransactions] = useState([]);
  const [fileNames, setFileNames] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [forecastMonths, setForecastMonths] = useState(3);
  const [excludedTransactions, setExcludedTransactions] = useState([]);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Load exclusions from localStorage on mount
  useEffect(() => {
    const savedExclusions = localStorage.getItem('budgetExclusions');
    if (savedExclusions) {
      setExcludedTransactions(JSON.parse(savedExclusions));
    }
  }, []);

  // Save exclusions to localStorage when changed
  useEffect(() => {
    localStorage.setItem('budgetExclusions', JSON.stringify(excludedTransactions));
  }, [excludedTransactions]);

  // File upload handling (same as before)
  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setLoading(true);
    setMessage(`Processing ${files.length} file(s)...`);
    setError('');
    setDebugInfo('');
    
    let newTransactions = [];
    let newFileNames = [...fileNames];
    let filesProcessed = 0;
    let debugLog = [];
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        debugLog.push(`File: ${file.name} - First 100 chars: ${text.substring(0, 100)}`);
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            if (results.data && results.data.length > 0) {
              const columns = results.meta.fields || [];
              debugLog.push(`File: ${file.name} - Columns found: ${columns.join(', ')}`);
              const processedData = processTransactions(results.data, file.name);
              debugLog.push(`File: ${file.name} - Processed ${processedData.length} transactions`);
              newTransactions = [...newTransactions, ...processedData];
              if (!newFileNames.includes(file.name)) {
                newFileNames.push(file.name);
              }
            } else {
              debugLog.push(`File: ${file.name} - No valid data found or parsing failed`);
            }
            filesProcessed++;
            if (filesProcessed === files.length) {
              const combinedTransactions = [...transactions, ...newTransactions];
              const sortedTransactions = combinedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
              const uniqueTransactions = removeDuplicates(sortedTransactions);
              debugLog.push(`Total transactions after processing: ${uniqueTransactions.length}`);
              setDebugInfo(debugLog.join('\n'));
              setTransactions(uniqueTransactions);
              setFileNames(newFileNames);
              setMessage(`Processed ${newTransactions.length} transactions from ${files.length} file(s)`);
              setLoading(false);
              setTimeout(() => setMessage(''), 5000);
            }
          },
          error: (error) => {
            console.error('Error parsing CSV:', error);
            debugLog.push(`File: ${file.name} - Error parsing: ${error.message}`);
            filesProcessed++;
            if (filesProcessed === files.length) {
              if (newTransactions.length > 0) {
                const combined = [...transactions, ...newTransactions];
                const unique = removeDuplicates(combined);
                setTransactions(unique);
                setFileNames(newFileNames);
                setMessage(`Processed with some errors`);
                setDebugInfo(debugLog.join('\n'));
              } else {
                setError('Error parsing CSV files');
                setDebugInfo(debugLog.join('\n'));
              }
              setLoading(false);
            }
          }
        });
      };
      reader.onerror = () => {
        debugLog.push(`File: ${file.name} - Error reading file`);
        filesProcessed++;
        if (filesProcessed === files.length) {
          setError('Error reading files');
          setDebugInfo(debugLog.join('\n'));
          setLoading(false);
        }
      };
      reader.readAsText(file);
    });
  };

  // Remove duplicate transactions based on date, amount, and description snippet
  const removeDuplicates = (transactions) => {
    const seen = new Set();
    return transactions.filter(t => {
      const key = `${t.date}-${t.amount}-${String(t.description).substring(0, 20)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Process transactions from CSV data (with source tracking)
  const processTransactions = (data, source) => {
    return data.map((item, index) => {
      let date = null;
      for (const key in item) {
        if (key && key.toLowerCase().includes('date')) {
          date = item[key];
          break;
        }
      }
      let amount = null;
      for (const key in item) {
        if (key && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('sum') || key.toLowerCase().includes('price') || key.toLowerCase() === 'debit' || key.toLowerCase() === 'credit')) {
          let value = item[key];
          if (value !== null && value !== undefined) {
            if (typeof value === 'string') {
              value = value.replace(/[^\d.-]/g, '');
            }
            const parsedAmount = parseFloat(value);
            if (!isNaN(parsedAmount)) {
              amount = parsedAmount;
              if (key.toLowerCase().includes('debit') || key.toLowerCase().includes('expense') || key.toLowerCase().includes('withdrawal') || key.toLowerCase().includes('payment')) {
                amount = -Math.abs(amount);
              }
              break;
            }
          }
        }
      }
      if (amount === null) {
        let debit = null, credit = null;
        for (const key in item) {
          if (key && key.toLowerCase().includes('debit')) {
            let value = item[key];
            if (typeof value === 'string') {
              value = value.replace(/[^\d.-]/g, '');
            }
            debit = parseFloat(value);
          }
          if (key && key.toLowerCase().includes('credit')) {
            let value = item[key];
            if (typeof value === 'string') {
              value = value.replace(/[^\d.-]/g, '');
            }
            credit = parseFloat(value);
          }
        }
        if (!isNaN(debit) && debit > 0) {
          amount = -debit;
        } else if (!isNaN(credit) && credit > 0) {
          amount = credit;
        }
      }
      if (amount === null || isNaN(amount)) {
        amount = 0;
      }
      let description = 'Unknown';
      for (const key in item) {
        if (key && (key.toLowerCase().includes('description') || key.toLowerCase().includes('memo') || key.toLowerCase().includes('transaction') || key.toLowerCase().includes('payee') || key.toLowerCase().includes('merchant') || key.toLowerCase().includes('details'))) {
          if (item[key] !== null && item[key] !== undefined) {
            description = item[key];
            break;
          }
        }
      }
      let category = 'Uncategorized';
      for (const key in item) {
        if (key && (key.toLowerCase().includes('category') || key.toLowerCase().includes('type'))) {
          if (item[key] !== null && item[key] !== undefined) {
            category = item[key];
            break;
          }
        }
      }
      let formattedDate = date;
      if (date && typeof date === 'string') {
        try {
          const dateObj = new Date(date);
          if (!isNaN(dateObj.getTime())) {
            formattedDate = dateObj.toISOString().split('T')[0];
          }
        } catch (e) {
          // Keep original if parsing fails
        }
      } else if (date instanceof Date) {
        formattedDate = date.toISOString().split('T')[0];
      } else if (!date) {
        formattedDate = new Date().toISOString().split('T')[0];
      }
      return {
        id: `${source}-${index}`, // Add unique ID
        date: formattedDate,
        amount,
        description: String(description),
        category: String(category),
        source
      };
    }).filter(t => t.amount !== 0);
  };

  // Helper: Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(amount);
  };

  // Existing helper functions for dashboard and transactions
  const getIncomeTotal = () => {
    return transactions
      .filter(t => !excludedTransactions.includes(t.id) && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
  };
  const getExpenseTotal = () => {
    return transactions
      .filter(t => !excludedTransactions.includes(t.id) && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  };
  const getExpensesByCategory = () => {
    const expensesByCategory = {};
    transactions
      .filter(t => !excludedTransactions.includes(t.id) && t.amount < 0)
      .forEach(t => {
        if (!expensesByCategory[t.category]) {
          expensesByCategory[t.category] = 0;
        }
        expensesByCategory[t.category] += Math.abs(t.amount);
      });
    return expensesByCategory;
  };
  const getSourceStats = () => {
    const stats = {};
    fileNames.forEach(name => {
      const filtered = transactions.filter(t => t.source === name);
      const income = filtered.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      const expenses = filtered.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      stats[name] = { count: filtered.length, income, expenses };
    });
    return stats;
  };

  // NEW: Functions to support forecasting

  // Aggregate transactions by month (YYYY-MM)
  const getMonthlyData = () => {
    const monthlyData = {};
    transactions.forEach(t => {
      const monthYear = t.date.substring(0, 7);
      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = { income: 0, expenses: 0 };
      }
      if (t.amount > 0) {
        monthlyData[monthYear].income += t.amount;
      } else {
        monthlyData[monthYear].expenses += Math.abs(t.amount);
      }
    });
    return monthlyData;
  };

  // Generate forecast using historical averages
  const generateForecast = () => {
    const monthlyData = getMonthlyData();
    const months = Object.keys(monthlyData).sort();
    if (months.length === 0) return [];
    let totalIncome = 0, totalExpenses = 0;
    months.forEach(month => {
      totalIncome += monthlyData[month].income;
      totalExpenses += monthlyData[month].expenses;
    });
    const avgIncome = totalIncome / months.length;
    const avgExpenses = totalExpenses / months.length;
    const categoriesData = {};
    transactions.filter(t => t.amount < 0).forEach(t => {
      if (!categoriesData[t.category]) {
        categoriesData[t.category] = 0;
      }
      categoriesData[t.category] += Math.abs(t.amount);
    });
    const categoriesAvg = {};
    Object.keys(categoriesData).forEach(category => {
      categoriesAvg[category] = categoriesData[category] / months.length;
    });

    const forecast = [];
    const lastMonth = months[months.length - 1];
    const [lastYear, lastMonthNum] = lastMonth.split('-').map(n => parseInt(n));
    for (let i = 1; i <= forecastMonths; i++) {
      let forecastYear = lastYear;
      let forecastMonth = lastMonthNum + i;
      if (forecastMonth > 12) {
        forecastYear += Math.floor((forecastMonth - 1) / 12);
        forecastMonth = ((forecastMonth - 1) % 12) + 1;
      }
      const forecastDate = `${forecastYear}-${forecastMonth.toString().padStart(2, '0')}`;
      forecast.push({
        month: forecastDate,
        income: avgIncome,
        expenses: avgExpenses,
        categories: categoriesAvg,
        net: avgIncome - avgExpenses
      });
    }
    return forecast;
  };

  // Format a YYYY-MM string to "Mon YYYY" format
  const formatMonth = (monthYear) => {
    const [year, month] = monthYear.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Return a consistent color for each category
  const getCategoryColor = (category) => {
    const hash = category.split('').reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);
    const colors = ['#4299E1', '#48BB78', '#ED8936', '#9F7AEA', '#F56565', '#38B2AC', '#ECC94B', '#667EEA', '#F687B3', '#A0AEC0'];
    return colors[Math.abs(hash) % colors.length];
  };

  // NEW: Render the forecast view
  const renderForecast = () => {
    const forecast = generateForecast();
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex flex-wrap justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-medium mb-1">Budget Forecast</h3>
            <p className="text-sm text-gray-500">Based on your historical transaction data</p>
          </div>
          <div className="flex items-center space-x-1 mt-2 sm:mt-0">
            <span className="text-sm text-gray-600 mr-2">Forecast months:</span>
            {[3, 6, 12].map(months => (
              <button
                key={months}
                onClick={() => setForecastMonths(months)}
                className={`px-3 py-1 text-sm rounded ${forecastMonths === months ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                {months}
              </button>
            ))}
          </div>
        </div>
        {forecast.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full mb-6">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left text-sm font-medium">Month</th>
                    <th className="py-2 text-right text-sm font-medium">Projected Income</th>
                    <th className="py-2 text-right text-sm font-medium">Projected Expenses</th>
                    <th className="py-2 text-right text-sm font-medium">Net Cashflow</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 text-sm font-medium">{formatMonth(item.month)}</td>
                      <td className="py-2 text-right text-sm text-green-600">{formatCurrency(item.income)}</td>
                      <td className="py-2 text-right text-sm text-red-600">-{formatCurrency(item.expenses)}</td>
                      <td className={`py-2 text-right text-sm font-medium ${item.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(item.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-8">
              <h4 className="text-md font-medium mb-4">Projected Monthly Expenses by Category</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {forecast[0] && forecast[0].categories && Object.entries(forecast[0].categories)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, amount]) => (
                    <div key={category} className="flex items-center p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{category}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(amount)} per month</p>
                      </div>
                      <div 
                        className="w-3 h-12 rounded"
                        style={{ 
                          backgroundColor: getCategoryColor(category),
                          opacity: Math.min(1, amount / (forecast[0].expenses * 0.4))
                        }}
                      ></div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="mt-8 p-4 bg-gray-50 rounded">
              <div className="flex items-start">
                <TrendingUp className="text-blue-500 mr-3 mt-1" size={20} />
                <div>
                  <h4 className="text-md font-medium">Forecast Summary</h4>
                  <p className="text-sm mt-1 text-gray-600">
                    Over the next {forecastMonths} months, you're projected to 
                    {forecast.reduce((sum, f) => sum + f.net, 0) >= 0 ? ' save ' : ' lose '}
                    <span className={`font-medium ${forecast.reduce((sum, f) => sum + f.net, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(forecast.reduce((sum, f) => sum + f.net, 0)))}
                    </span>
                  </p>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-green-50 rounded">
                      <p className="text-xs text-green-800 font-medium">Total Income</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(forecast.reduce((sum, f) => sum + f.income, 0))}
                      </p>
                    </div>
                    <div className="p-3 bg-red-50 rounded">
                      <p className="text-xs text-red-800 font-medium">Total Expenses</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(forecast.reduce((sum, f) => sum + f.expenses, 0))}
                      </p>
                    </div>
                    <div className={`p-3 rounded ${forecast.reduce((sum, f) => sum + f.net, 0) >= 0 ? 'bg-blue-50' : 'bg-amber-50'}`}>
                      <p className={`text-xs font-medium ${forecast.reduce((sum, f) => sum + f.net, 0) >= 0 ? 'text-blue-800' : 'text-amber-800'}`}>
                        Net Cashflow
                      </p>
                      <p className={`text-lg font-bold ${forecast.reduce((sum, f) => sum + f.net, 0) >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                        {formatCurrency(forecast.reduce((sum, f) => sum + f.net, 0))}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    Note: This forecast is based on your historical average income and spending patterns.
                    Actual results may vary based on your future financial decisions.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <TrendingUp className="mx-auto text-gray-400 mb-4" size={64} />
            <p className="text-gray-500">Not enough transaction data to generate a forecast.</p>
            <p className="text-sm text-gray-400 mt-2">Upload more transactions with different date ranges.</p>
          </div>
        )}
      </div>
    );
  };

  // Render existing dashboard view
  const renderDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Financial Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center mb-2">
              <DollarSign className="text-green-500 mr-2" size={20} />
              <span className="text-sm font-medium">Total Income</span>
            </div>
            <p className="text-xl font-bold text-green-600">{formatCurrency(getIncomeTotal())}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="flex items-center mb-2">
              <CreditCard className="text-red-500 mr-2" size={20} />
              <span className="text-sm font-medium">Total Expenses</span>
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(getExpenseTotal())}</p>
          </div>
        </div>
        
        <h4 className="text-md font-medium mt-6 mb-3">Recent Transactions</h4>
        <div className="overflow-auto max-h-64">
          <ul className="divide-y divide-gray-200">
            {transactions.slice(0, 10).map((transaction, index) => (
              <li key={index} className="py-2">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-medium">{transaction.description}</p>
                    <p className="text-xs text-gray-500">{transaction.date} | {transaction.category}</p>
                  </div>
                  <p className={`text-sm font-medium ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(transaction.amount)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Expense Breakdown</h3>
        {Object.keys(getExpensesByCategory()).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(getExpensesByCategory())
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{category}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="h-2.5 rounded-full bg-blue-600"
                        style={{ width: `${(amount / getExpenseTotal()) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-sm font-medium ml-4">{formatCurrency(amount)}</p>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No expense data available.</p>
        )}
        
        <h4 className="text-md font-medium mt-6 mb-3">Imported Files</h4>
        <div className="overflow-auto max-h-36">
          <ul className="divide-y divide-gray-200">
            {Object.entries(getSourceStats()).map(([file, stats], index) => (
              <li key={index} className="py-2">
                <p className="text-sm font-medium">{file}</p>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{stats.count} transactions</span>
                  <span>
                    {formatCurrency(stats.income)} in / {formatCurrency(stats.expenses)} out
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  // Render transactions view
  const renderTransactions = () => (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-medium mb-4">All Transactions ({transactions.length})</h3>
      <ExclusionSummary />
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">Exclude</th>
              <th className="p-2">Date</th>
              <th className="p-2">Description</th>
              <th className="p-2">Category</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2">Source</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                editingTransaction={editingTransaction}
                editFormData={editFormData}
                excludedTransactions={excludedTransactions}
                onToggleExclusion={toggleTransactionExclusion}
                onEditChange={handleEditChange}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
                onEditClick={handleEditClick}
                formatCurrency={formatCurrency}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render debug view (unchanged)
  const renderDebug = () => (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-medium mb-4">Debug Information</h3>
      <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
        {debugInfo}
      </pre>
    </div>
  );

  // Add toggle function for excluding transactions
  const toggleTransactionExclusion = (transactionId) => {
    setExcludedTransactions(prev => 
      prev.includes(transactionId)
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  // Modify calculations to filter out excluded transactions
  const calculateTotals = () => {
    const includedTransactions = transactions.filter(t => !excludedTransactions.includes(t.id));
    // ... rest of calculation logic using includedTransactions
  };

  // Add exclusion management UI
  const ExclusionManager = () => (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Transaction Exclusions</h3>
      <div className="text-sm text-gray-600">
        {excludedTransactions.length} transaction(s) excluded from calculations
      </div>
      {excludedTransactions.length > 0 && (
        <button
          onClick={() => setExcludedTransactions([])}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Clear All Exclusions
        </button>
      )}
    </div>
  );

  // Add edit handler functions
  const handleEditClick = (transaction) => {
    setEditingTransaction(transaction.id);
    setEditFormData({
      date: transaction.date,
      description: transaction.description,
      category: transaction.category,
      amount: transaction.amount
    });
  };

  const handleEditChange = React.useCallback((field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleEditSave = (transactionId) => {
    setTransactions(prev => prev.map(t => 
      t.id === transactionId
        ? { ...t, ...editFormData }
        : t
    ));
    setEditingTransaction(null);
    setEditFormData({});
  };

  const handleEditCancel = () => {
    setEditingTransaction(null);
    setEditFormData({});
  };

  // Add an exclusion summary component
  const ExclusionSummary = () => {
    const excludedAmount = transactions
      .filter(t => excludedTransactions.includes(t.id))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return excludedTransactions.length > 0 ? (
      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-medium text-yellow-800">
              {excludedTransactions.length} transaction(s) excluded
            </h3>
            <p className="text-xs text-yellow-600 mt-1">
              Total excluded amount: {formatCurrency(excludedAmount)}
            </p>
          </div>
          <button
            onClick={() => setExcludedTransactions([])}
            className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
          >
            Clear All Exclusions
          </button>
        </div>
      </div>
    ) : null;
  };

  // Add these functions after the existing state declarations
  const saveTransactionsToFile = () => {
    // Convert transactions to CSV format
    const headers = ['date', 'description', 'category', 'amount', 'source'];
    const csvContent = [
      headers.join(','),
      ...transactions.map(t => [
        t.date,
        `"${t.description.replace(/"/g, '""')}"`, // Escape quotes in description
        `"${t.category.replace(/"/g, '""')}"`,
        t.amount,
        `"${t.source.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `combined_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add export/import buttons to the header section
  const renderHeaderActions = () => (
    <div className="flex gap-4 mt-4">
      <button
        onClick={saveTransactionsToFile}
        disabled={transactions.length === 0}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Export Combined Data
      </button>
    </div>
  );

  // Update the header section in the main return statement
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Multi-Statement Budget App</h1>
            <p className="text-gray-600">Upload multiple CSV files to analyze your combined financial data</p>
          </div>
          {renderHeaderActions()}
        </div>
      </header>
      
      <div className="mb-6">
        <label className="block mb-2 text-sm font-medium text-gray-700">Upload CSV Files</label>
        <input 
          type="file" 
          multiple
          accept=".csv"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500 mb-4"
        />
        {loading && <p className="text-sm text-gray-500">Processing files...</p>}
        {message && <p className="text-sm text-blue-500">{message}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      
      <div className="mb-6">
        <div className="border-b border-gray-200 mb-4">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-4 text-sm font-medium ${activeTab === 'dashboard' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('forecast')}
              className={`py-2 px-4 text-sm font-medium ${activeTab === 'forecast' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Forecast
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-2 px-4 text-sm font-medium ${activeTab === 'transactions' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('debug')}
              className={`py-2 px-4 text-sm font-medium ${activeTab === 'debug' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Debug
            </button>
          </nav>
        </div>
      </div>
      
      {transactions.length > 0 ? (
        activeTab === 'dashboard' ? renderDashboard() : 
        activeTab === 'forecast' ? renderForecast() :
        activeTab === 'transactions' ? renderTransactions() :
        activeTab === 'debug' ? renderDebug() : null
      ) : (
        <div className="p-6 bg-white rounded-lg shadow text-center">
          <FileText className="mx-auto text-gray-400 mb-4" size={64} />
          <p className="text-gray-500">No transactions to display. Upload multiple CSV statements to get started.</p>
          <p className="text-sm text-gray-400 mt-2">
            You can upload bank statements, credit card statements, and other financial CSVs.
          </p>
        </div>
      )}
    </div>
  );
};

// First, move TransactionRow outside the main component
const TransactionRow = React.memo(({ 
  transaction, 
  editingTransaction,
  editFormData,
  excludedTransactions,
  onToggleExclusion,
  onEditChange,
  onEditSave,
  onEditCancel,
  onEditClick,
  formatCurrency
}) => (
  <tr className={`border-b ${excludedTransactions.includes(transaction.id) ? 'bg-gray-100' : ''}`}>
    <td className="p-2">
      <input
        type="checkbox"
        checked={excludedTransactions.includes(transaction.id)}
        onChange={() => onToggleExclusion(transaction.id)}
        className="rounded border-gray-300"
      />
    </td>
    {editingTransaction === transaction.id ? (
      <>
        <td className="p-2">
          <input
            type="date"
            value={editFormData.date || ''}
            onChange={(e) => onEditChange('date', e.target.value)}
            className="w-full p-1 border rounded"
          />
        </td>
        <td className="p-2">
          <input
            type="text"
            value={editFormData.description || ''}
            onChange={(e) => onEditChange('description', e.target.value)}
            className="w-full p-1 border rounded"
          />
        </td>
        <td className="p-2">
          <input
            type="text"
            value={editFormData.category || ''}
            onChange={(e) => onEditChange('category', e.target.value)}
            className="w-full p-1 border rounded"
          />
        </td>
        <td className="p-2">
          <input
            type="number"
            value={editFormData.amount || ''}
            onChange={(e) => onEditChange('amount', parseFloat(e.target.value) || 0)}
            className="w-full p-1 border rounded text-right"
            step="0.01"
          />
        </td>
        <td className="p-2">
          <input
            type="text"
            value={editFormData.source || ''}
            onChange={(e) => onEditChange('source', e.target.value)}
            className="w-full p-1 border rounded"
          />
        </td>
        <td className="p-2">
          <div className="flex gap-2">
            <button
              onClick={() => onEditSave(transaction.id)}
              className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Save
            </button>
            <button
              onClick={onEditCancel}
              className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </td>
      </>
    ) : (
      <>
        <td className="p-2">{transaction.date}</td>
        <td className="p-2">{transaction.description}</td>
        <td className="p-2">{transaction.category}</td>
        <td className="p-2 text-right">{formatCurrency(transaction.amount)}</td>
        <td className="p-2">
          <span className="text-sm text-gray-600">{transaction.source}</span>
        </td>
        <td className="p-2">
          <button
            onClick={() => onEditClick(transaction)}
            className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Edit
          </button>
        </td>
      </>
    )}
  </tr>
), (prevProps, nextProps) => {
  // Custom comparison function
  return (
    prevProps.transaction.id === nextProps.transaction.id &&
    prevProps.editingTransaction === nextProps.editingTransaction &&
    JSON.stringify(prevProps.editFormData) === JSON.stringify(nextProps.editFormData) &&
    prevProps.excludedTransactions === nextProps.excludedTransactions
  );
});

export default ImprovedMultiStatementBudget;