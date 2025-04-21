import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CreditCard, DollarSign, FileText, TrendingUp } from 'lucide-react';
import Papa from 'papaparse';

// -----------------------------
// TransactionRow Component
// -----------------------------
// Wrapped in React.memo with a comparator for performance.
const TransactionRow = React.memo(
  ({
    transaction,
    editingTransaction,
    editFormData,
    excludedTransactions,
    onToggleExclusion,
    onEditChange,
    onEditSave,
    onEditCancel,
    onEditClick,
    formatCurrency,
  }) => (
    <tr
      className={`border-b ${
        excludedTransactions.includes(transaction.id) ? 'bg-gray-100' : ''
      }`}
    >
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
              onChange={(e) =>
                onEditChange('amount', parseFloat(e.target.value) || 0)
              }
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
          <td
            className={`p-2 text-right ${
              transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {transaction.amount > 0
              ? formatCurrency(transaction.amount)
              : `-${formatCurrency(Math.abs(transaction.amount))}`}
          </td>
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
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.transaction.id === nextProps.transaction.id &&
      prevProps.editingTransaction === nextProps.editingTransaction &&
      JSON.stringify(prevProps.editFormData) ===
        JSON.stringify(nextProps.editFormData) &&
      prevProps.excludedTransactions === nextProps.excludedTransactions
    );
  }
);

// -----------------------------
// Reconciliation Renderer (memoizable as stateless)
// -----------------------------
const renderReconciliation = (
  month,
  data,
  formatCurrency,
  endingBalances,
  handleEndingBalanceChange
) => {
  if (!month || !data) return null;

  const monthTransactions = data.transactions
    .filter((t) => t.balance !== undefined)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (monthTransactions.length === 0) return null;

  const firstTransaction = monthTransactions[0];
  const lastDate = monthTransactions[monthTransactions.length - 1].date;
  const lastDayTransactions = monthTransactions
    .filter((t) => t.date === lastDate)
    .sort((a, b) => a.balance - b.balance);
  const startingBalance = firstTransaction.balance - firstTransaction.amount;
  const endingBalance =
    lastDayTransactions[lastDayTransactions.length - 1].balance;
  const expectedEndingBalance = startingBalance + data.income - data.expenses;

  return (
    <div className="mt-8 bg-white p-6 rounded-lg border border-blue-200">
      <h4 className="text-lg font-medium mb-4 text-gray-800">
        Balance Reconciliation
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">
              Starting Balance:
            </span>
            <span className="text-sm font-bold">
              {formatCurrency(startingBalance)}
            </span>
          </div>
          <div className="flex justify-between items-center text-green-600">
            <span className="text-sm font-medium">Total Income:</span>
            <span className="text-sm font-bold">
              +{formatCurrency(data.income)}
            </span>
          </div>
          <div className="flex justify-between items-center text-red-600">
            <span className="text-sm font-medium">Total Expenses:</span>
            <span className="text-sm font-bold">
              -{formatCurrency(data.expenses)}
            </span>
          </div>
          <div className="border-t pt-4 flex justify-between items-center">
            <span className="text-sm font-medium">
              Expected Ending Balance:
            </span>
            <span className="text-sm font-bold">
              {formatCurrency(expectedEndingBalance)}
            </span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Actual Ending Balance:</span>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={endingBalances[month] || ''}
                onChange={(e) =>
                  handleEndingBalanceChange(month, e.target.value)
                }
                className="w-32 p-1 border rounded text-right"
                step="0.01"
                placeholder="Enter balance"
              />
              <span className="text-sm font-bold">
                {endingBalances[month]
                  ? formatCurrency(endingBalances[month])
                  : '---'}
              </span>
            </div>
          </div>
          <div
            className={`flex justify-between items-center ${
              Math.abs(endingBalances[month] - expectedEndingBalance) > 0.01
                ? 'text-red-600'
                : 'text-green-600'
            }`}
          >
            <span className="text-sm font-medium">Discrepancy:</span>
            <span className="text-sm font-bold">
              {endingBalances[month]
                ? formatCurrency(endingBalances[month] - expectedEndingBalance)
                : '---'}
            </span>
          </div>
          {endingBalances[month] &&
            Math.abs(endingBalances[month] - expectedEndingBalance) > 0.01 && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                <h5 className="text-sm font-medium text-yellow-800 mb-2">
                  Possible Causes:
                </h5>
                <ul className="text-xs text-yellow-700 space-y-1 list-disc pl-4">
                  <li>Pending transactions not yet posted</li>
                  <li>Missing transactions in imported data</li>
                  <li>Transactions categorized incorrectly</li>
                  <li>Bank fees or interest not captured</li>
                </ul>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

// -----------------------------
// Main Component
// -----------------------------
const MultiStatementBudget = () => {
  // State declarations
  // Changed fileNames to hold objects (with "name" and "accountType") for proper management.
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
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [endingBalances, setEndingBalances] = useState({});
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [editedCategories, setEditedCategories] = useState({});
  const [isSavingCategories, setIsSavingCategories] = useState(false);

  // -----------------------------
  // Effects for localStorage (Exclusions)
  // -----------------------------
  useEffect(() => {
    const savedExclusions = localStorage.getItem('budgetExclusions');
    if (savedExclusions) {
      setExcludedTransactions(JSON.parse(savedExclusions));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('budgetExclusions', JSON.stringify(excludedTransactions));
  }, [excludedTransactions]);

  // -----------------------------
  // File Upload & Processing Handlers
  // -----------------------------
  const handleFileUpload = useCallback((event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
  
    setLoading(true);
    setMessage(`Processing ${files.length} file(s)...`);
    setError('');
    setDebugInfo('');
  
    let newTransactions = [];
    let newFileNames = [...fileNames];
    let filesProcessed = 0;
    const debugLog = [];
  
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
  
        // Save the file content to localStorage
        localStorage.setItem(`fileContent_${file.name}`, text);
  
        debugLog.push(`File: ${file.name} - First 100 chars: ${text.substring(0, 100)}`);
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            if (results.data && results.data.length > 0) {
              const processedData = processTransactions(results.data, file.name);
              debugLog.push(`File: ${file.name} - Processed ${processedData.length} transactions`);
              newTransactions = [...newTransactions, ...processedData];
              if (!newFileNames.some((f) => f.name === file.name)) {
                // Save the full path along with the file name
                newFileNames.push({
                  name: file.name,
                  path: file.webkitRelativePath || file.name, // Use `webkitRelativePath` if available
                  accountType: 'Personal',
                });
              }
            } else {
              debugLog.push(`File: ${file.name} - No valid data found or parsing failed`);
            }
            filesProcessed++;
            if (filesProcessed === files.length) {
              const combinedTransactions = [...transactions, ...newTransactions];
              const uniqueTransactions = removeDuplicates(combinedTransactions);
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
          },
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
  }, [fileNames, transactions]);

  // New wrapper that checks for metadata then calls the original upload
  const handleFileUploadWithMetadata = useCallback(
    (event) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          const lines = text.split('\n');
          // Look for a metadata line starting with the expected tag.
          const metadataLine = lines.find((line) =>
            line.startsWith('# METADATA=')
          );
          if (metadataLine) {
            try {
              const metadata = JSON.parse(
                metadataLine.replace('# METADATA=', '')
              );
              // Restore the ending balances from metadata.
              if (metadata.endingBalances) {
                setEndingBalances(metadata.endingBalances);
              }
              // Restore the edited categories if available.
              if (metadata.editedCategories) {
                setEditedCategories(metadata.editedCategories);
              }
              // Restore the source files (file names and account types).
              if (metadata.sourceFiles) {
                setFileNames(metadata.sourceFiles);
              }
            } catch (e) {
              console.error('Error parsing metadata:', e);
            }
          }
          // Proceed with processing the CSV transactions.
          // (This call uses your original file-upload handler.)
          handleFileUpload(event);
        };
        reader.readAsText(files[0]);
      }
    },
    [handleFileUpload]
  );  

  // -----------------------------
  // Helper Functions (CSV parsing, deduplication, formatting)
  // -----------------------------
  const removeDuplicates = (transactions) => {
    const seen = new Set();
    return transactions.filter((t) => {
      const key = `${t.date}-${t.amount}-${String(t.description).substring(0, 20)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const processTransactions = (data, source) => {
    const headers = data[0] ? Object.keys(data[0]) : [];
    const isCreditCardStatement = headers[0]?.toLowerCase().includes('card');
    const isBankingStatement = headers[0]?.toLowerCase().includes('details');
    if (!isCreditCardStatement && !isBankingStatement) {
      console.warn('Unknown statement type:', headers[0]);
      return [];
    }
    return data
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        if (isCreditCardStatement) {
          const transactionDate = formatDate(item['Transaction Date']);
          const description = String(item['Description'] || '');
          let category = String(item['Category'] || 'Credit Card');
          const type = String(item['Type'] || '');
          let amount = parseAmount(item['Amount']);
          if (type.toLowerCase().includes('debit') || type.toLowerCase().includes('purchase')) {
            amount = Math.abs(amount) * -1;
          } else if (type.toLowerCase().includes('credit') || type.toLowerCase().includes('payment')) {
            amount = Math.abs(amount);
          }
          if (!transactionDate || amount === null) return null;
          return {
            id: `${source}-${index}`,
            date: transactionDate,
            description,
            category,
            type,
            amount,
            source,
            isCredit: true,
          };
        } else if (isBankingStatement) {
          const transactionDate = formatDate(item['Posting Date']);
          const description = String(item['Description'] || '');
          const category = String(item['Type'] || 'Banking');
          const type = String(item['Type'] || '');
          let amount = parseAmount(item['Amount']);
          const balance = parseAmount(item['Balance']);
          if (!transactionDate || amount === null) return null;
          return {
            id: `${source}-${index}`,
            date: transactionDate,
            description,
            category,
            type,
            amount,
            balance,
            source,
            isCredit: false,
          };
        }
        return null;
      })
      .filter((t) => t !== null);
  };

  const parseAmount = (value) => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const cleanValue = String(value)
      .replace(/[^0-9.-]/g, '')
      .replace(/^\./, '0.')
      .replace(/^(-?)\./, '$10.');
    return parseFloat(cleanValue) || 0;
  };

  const formatDate = (value) => {
    if (!value) return null;
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    } catch (e) {
      return null;
    }
  };

  // Legacy helpers preserved for backward compatibility
  const formatDateOld = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (e) {
      return dateString;
    }
  };

  const parseAmountOld = (amountString) => {
    if (typeof amountString === 'number') return amountString;
    if (!amountString) return 0;
    const cleanAmount = amountString.replace(/[^0-9.-]/g, '');
    return parseFloat(cleanAmount) || 0;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // -----------------------------
  // Derived Data: Totals, Monthly Data, Unique Filters (using useMemo)
  // -----------------------------
  const incomeTotal = useMemo(
    () =>
      transactions
        .filter((t) => !excludedTransactions.includes(t.id) && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions, excludedTransactions]
  );

  const expenseTotal = useMemo(
    () =>
      transactions
        .filter((t) => !excludedTransactions.includes(t.id) && t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    [transactions, excludedTransactions]
  );

  const getExpensesByCategory = useCallback(() => {
    const expensesByCategory = {};
    transactions
      .filter((t) => !excludedTransactions.includes(t.id) && t.amount < 0)
      .forEach((t) => {
        expensesByCategory[t.category] =
          (expensesByCategory[t.category] || 0) + Math.abs(t.amount);
      });
    return expensesByCategory;
  }, [transactions, excludedTransactions]);

  const monthlyData = useMemo(() => {
    const data = {};
    transactions.forEach((t) => {
      const monthYear = t.date.substring(0, 7);
      if (!data[monthYear]) {
        data[monthYear] = {
          income: 0,
          expenses: 0,
          transactions: [],
          categories: {
            income: {},
            expense: {},
          },
        };
      }
      if (!excludedTransactions.includes(t.id)) {
        if (t.amount > 0) {
          data[monthYear].income += t.amount;
          data[monthYear].categories.income[t.category] =
            (data[monthYear].categories.income[t.category] || 0) + t.amount;
        } else {
          data[monthYear].expenses += Math.abs(t.amount);
          data[monthYear].categories.expense[t.category] =
            (data[monthYear].categories.expense[t.category] || 0) +
            Math.abs(t.amount);
        }
        data[monthYear].transactions.push(t);
      }
    });
    return data;
  }, [transactions, excludedTransactions]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set(transactions.map((t) => t.category));
    return ['all', ...Array.from(categories)].sort();
  }, [transactions]);

  const uniqueSources = useMemo(() => {
    const sources = new Set(transactions.map((t) => t.source));
    return ['all', ...Array.from(sources)].sort();
  }, [transactions]);

  // -----------------------------
  // Forecast Functions
  // -----------------------------
  const generateForecast = () => {
    const months = Object.keys(getMonthlyData()).sort();
    if (months.length === 0) return [];
    let totalIncome = 0,
      totalExpenses = 0;
    months.forEach((month) => {
      totalIncome += getMonthlyData()[month].income;
      totalExpenses += getMonthlyData()[month].expenses;
    });
    const avgIncome = totalIncome / months.length;
    const avgExpenses = totalExpenses / months.length;

    const categoriesData = {};
    transactions.filter((t) => t.amount < 0).forEach((t) => {
      categoriesData[t.category] =
        (categoriesData[t.category] || 0) + Math.abs(t.amount);
    });
    const categoriesAvg = {};
    Object.keys(categoriesData).forEach((category) => {
      categoriesAvg[category] = categoriesData[category] / months.length;
    });

    const forecast = [];
    const lastMonth = months[months.length - 1];
    const [lastYear, lastMonthNum] = lastMonth.split('-').map((n) => parseInt(n));
    for (let i = 1; i <= forecastMonths; i++) {
      let forecastYear = lastYear;
      let forecastMonth = lastMonthNum + i;
      if (forecastMonth > 12) {
        forecastYear += Math.floor((forecastMonth - 1) / 12);
        forecastMonth = ((forecastMonth - 1) % 12) + 1;
      }
      const forecastDate = `${forecastYear}-${forecastMonth
        .toString()
        .padStart(2, '0')}`;
      forecast.push({
        month: forecastDate,
        income: avgIncome,
        expenses: avgExpenses,
        categories: categoriesAvg,
        net: avgIncome - avgExpenses,
      });
    }
    return forecast;
  };

  const getMonthlyData = () => {
    // This reuses monthlyData from useMemo
    return monthlyData;
  };

  const formatMonth = (monthYear) => {
    const [year, month] = monthYear.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  const getCategoryColor = (category) => {
    const hash = category.split('').reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);
    const colors = ['#4299E1', '#48BB78', '#ED8936', '#9F7AEA', '#F56565', '#38B2AC', '#ECC94B', '#667EEA', '#F687B3', '#A0AEC0'];
    return colors[Math.abs(hash) % colors.length];
  };

  // -----------------------------
  // Renderers for Different Views
  // -----------------------------
  // Forecast Renderer
  const renderForecast = () => {
    const forecast = generateForecast();
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex flex-wrap justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-medium mb-1">Budget Forecast</h3>
            <p className="text-sm text-gray-500">
              Based on your historical transaction data
            </p>
          </div>
          <div className="flex items-center space-x-1 mt-2 sm:mt-0">
            <span className="text-sm text-gray-600 mr-2">Forecast months:</span>
            {[3, 6, 12].map((months) => (
              <button
                key={months}
                onClick={() => setForecastMonths(months)}
                className={`px-3 py-1 text-sm rounded ${
                  forecastMonths === months
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
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
                      <td className="py-2 text-right text-sm text-green-600">
                        {formatCurrency(item.income)}
                      </td>
                      <td className="py-2 text-right text-sm text-red-600">
                        -{formatCurrency(item.expenses)}
                      </td>
                      <td
                        className={`py-2 text-right text-sm font-medium ${
                          item.net >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(item.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-8">
              <h4 className="text-md font-medium mb-4">
                Projected Monthly Expenses by Category
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {forecast[0] &&
                  forecast[0].categories &&
                  Object.entries(forecast[0].categories)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => (
                      <div key={category} className="flex items-center p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{category}</p>
                          <p className="text-xs text-gray-500">
                            {formatCurrency(amount)} per month
                          </p>
                        </div>
                        <div
                          className="w-3 h-12 rounded"
                          style={{
                            backgroundColor: getCategoryColor(category),
                            opacity: Math.min(1, amount / (forecast[0].expenses * 0.4)),
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
                    Over the next {forecastMonths} months, you're projected to{' '}
                    {forecast.reduce((sum, f) => sum + f.net, 0) >= 0 ? ' save ' : ' lose '}
                    <span
                      className={`font-medium ${
                        forecast.reduce((sum, f) => sum + f.net, 0) >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(
                        Math.abs(forecast.reduce((sum, f) => sum + f.net, 0))
                      )}
                    </span>
                  </p>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-green-50 rounded">
                      <p className="text-xs text-green-800 font-medium">
                        Total Income
                      </p>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(forecast.reduce((sum, f) => sum + f.income, 0))}
                      </p>
                    </div>
                    <div className="p-3 bg-red-50 rounded">
                      <p className="text-xs text-red-800 font-medium">
                        Total Expenses
                      </p>
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(forecast.reduce((sum, f) => sum + f.expenses, 0))}
                      </p>
                    </div>
                    <div
                      className={`p-3 rounded ${
                        forecast.reduce((sum, f) => sum + f.net, 0) >= 0
                          ? 'bg-blue-50'
                          : 'bg-amber-50'
                      }`}
                    >
                      <p
                        className={`text-xs font-medium ${
                          forecast.reduce((sum, f) => sum + f.net, 0) >= 0
                            ? 'text-blue-800'
                            : 'text-amber-800'
                        }`}
                      >
                        Net Cashflow
                      </p>
                      <p
                        className={`text-lg font-bold ${
                          forecast.reduce((sum, f) => sum + f.net, 0) >= 0
                            ? 'text-blue-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {formatCurrency(forecast.reduce((sum, f) => sum + f.net, 0))}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    Note: This forecast is based on your historical average income and
                    spending patterns. Actual results may vary based on your future financial
                    decisions.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <TrendingUp className="mx-auto text-gray-400 mb-4" size={64} />
            <p className="text-gray-500">Not enough transaction data to generate a forecast.</p>
            <p className="text-sm text-gray-400 mt-2">
              Upload more transactions with different date ranges.
            </p>
          </div>
        )}
      </div>
    );
  };

  // Current Month View Renderer
  const renderCurrent = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const months = Object.keys(monthlyData)
      .sort()
      .filter((month) => month <= currentMonth);

    // Category breakdown renderer for a given month
    const renderCategoryBreakdown = (month) => {
      if (!month || !monthlyData[month]) return null;
      const data = monthlyData[month];
    
      // Separate transactions into banking vs. credit card
      const bankingTransactions = data.transactions.filter(
        (t) => !t.category.toLowerCase().includes('credit card') && !t.isCredit
      );
      const creditTransactions = data.transactions.filter((t) => t.isCredit);
    
      // Group banking transactions by account (source)
      const bankingAccounts = bankingTransactions.reduce((acc, t) => {
        if (!acc[t.source]) acc[t.source] = [];
        acc[t.source].push(t);
        return acc;
      }, {});
    
      // Calculate starting and ending balances for each account
      const accountBalances = Object.entries(bankingAccounts).map(
        ([account, transactions]) => {
          const sortedTransactions = transactions.sort(
            (a, b) => new Date(a.date) - new Date(b.date)
          );
          const startingBalance =
            sortedTransactions[0]?.balance - sortedTransactions[0]?.amount || 0;
          const endingBalance =
            sortedTransactions[sortedTransactions.length - 1]?.balance || 0;
    
          return { account, startingBalance, endingBalance };
        }
      );
    
      // Banking calculations
      const bankingIncome = bankingTransactions
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const bankingExpenses = bankingTransactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
      const bankingIncomeByCategory = {};
      bankingTransactions.forEach((t) => {
        if (t.amount > 0) {
          bankingIncomeByCategory[t.category] =
            (bankingIncomeByCategory[t.category] || 0) + Math.abs(t.amount);
        }
      });
    
      const bankingExpensesByCategory = {};
      bankingTransactions.forEach((t) => {
        if (t.amount < 0) {
          bankingExpensesByCategory[t.category] =
            (bankingExpensesByCategory[t.category] || 0) + Math.abs(t.amount);
        }
      });
    
      // Credit card calculations
      const creditExpenses = creditTransactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
      const creditExpensesByCategory = {};
      creditTransactions
        .filter((t) => t.amount < 0)
        .forEach((t) => {
          creditExpensesByCategory[t.category] =
            (creditExpensesByCategory[t.category] || 0) + Math.abs(t.amount);
        });
    
      return (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Banking Panel */}
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <h4 className="text-lg font-medium mb-4 text-gray-800">
              Banking Summary
            </h4>
            <div className="space-y-4">
              <div className="p-2 bg-gray-50 rounded">
                <h5 className="text-sm font-medium text-gray-700 mb-2">
                  Starting Balances by Account
                </h5>
                {accountBalances.map(({ account, startingBalance }) => (
                  <div
                    key={account}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-gray-600">{account}</span>
                    <span className="font-bold">
                      {formatCurrency(startingBalance)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4">
                <h5 className="text-sm font-medium text-gray-600 mb-2">
                  Income Sources
                </h5>
                <div className="space-y-2">
                  {Object.entries(bankingIncomeByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{category}</span>
                        <span className="text-sm text-green-600">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    ))}
                </div>
                <div className="mt-2 pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Total Income</span>
                    <span className="text-sm font-bold text-green-600">
                      {formatCurrency(bankingIncome)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h5 className="text-sm font-medium text-gray-600 mb-2">
                  Banking Expenses
                </h5>
                <div className="space-y-2">
                  {Object.entries(bankingExpensesByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{category}</span>
                        <span className="text-sm text-red-600">
                          -{formatCurrency(amount)}
                        </span>
                      </div>
                    ))}
                </div>
                <div className="mt-2 pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">
                      Total Banking Expenses
                    </span>
                    <span className="text-sm font-bold text-red-600">
                      -{formatCurrency(bankingExpenses)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">
                  Calculated Ending Balances by Account
                </h5>
                {accountBalances.map(({ account, endingBalance }) => (
                  <div
                    key={account}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-gray-600">{account}</span>
                    <span className="font-bold">
                      {formatCurrency(endingBalance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Credit Card Panel */}
          <div className="bg-white p-4 rounded-lg border border-red-200">
            <h4 className="text-lg font-medium mb-4 text-gray-800">
              Credit Card Expenses
            </h4>
            <div className="space-y-3">
              {Object.entries(creditExpensesByCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => {
                  const percentage = ((amount / creditExpenses) * 100).toFixed(1);
                  return (
                    <div
                      key={category}
                      className="flex items-center justify-between space-x-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1">
                          <p className="text-sm font-medium text-gray-700 truncate">
                            {category}
                          </p>
                          <span className="text-sm text-gray-500">
                            {percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-red-500"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                        {formatCurrency(amount)}
                      </p>
                    </div>
                  );
                })}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    Total Credit Card Expenses
                  </span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(creditExpenses)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-medium mb-1">Monthly Analysis</h3>
            <p className="text-sm text-gray-500">Income and expenses by month</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full mb-6">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left text-sm font-medium">Month</th>
                <th className="py-2 text-right text-sm font-medium">Income</th>
                <th className="py-2 text-right text-sm font-medium">Expenses</th>
                <th className="py-2 text-right text-sm font-medium">Net</th>
                <th className="py-2 text-right text-sm font-medium">
                  Transaction Count
                </th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const data = monthlyData[month];
                const net = data.income - data.expenses;
                return (
                  <tr
                    key={month}
                    className={`border-b hover:bg-gray-50 cursor-pointer ${
                      selectedMonth === month ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedMonth(month)}
                  >
                    <td className="py-2 text-sm font-medium">{formatMonth(month)}</td>
                    <td className="py-2 text-right text-sm text-green-600">
                      {formatCurrency(data.income)}
                    </td>
                    <td className="py-2 text-right text-sm text-red-600">
                      -{formatCurrency(data.expenses)}
                    </td>
                    <td
                      className={`py-2 text-right text-sm font-medium ${
                        net >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(net)}
                    </td>
                    <td className="py-2 text-right text-sm text-gray-600">
                      {data.transactions.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-medium">
              <tr>
                <td className="py-2 text-sm">Totals</td>
                <td className="py-2 text-right text-sm text-green-600">
                  {formatCurrency(
                    months.reduce(
                      (sum, month) => sum + monthlyData[month].income,
                      0
                    )
                  )}
                </td>
                <td className="py-2 text-right text-sm text-red-600">
                  -{formatCurrency(
                    months.reduce(
                      (sum, month) => sum + monthlyData[month].expenses,
                      0
                    )
                  )}
                </td>
                <td className="py-2 text-right text-sm">
                  {formatCurrency(
                    months.reduce(
                      (sum, month) =>
                        sum + (monthlyData[month].income - monthlyData[month].expenses),
                      0
                    )
                  )}
                </td>
                <td className="py-2 text-right text-sm text-gray-600">
                  {months.reduce(
                    (sum, month) => sum + monthlyData[month].transactions.length,
                    0
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {selectedMonth && renderCategoryBreakdown(selectedMonth)}
        {selectedMonth &&
          renderReconciliation(
            selectedMonth,
            monthlyData[selectedMonth],
            formatCurrency,
            endingBalances,
            handleEndingBalanceChange
          )}
      </div>
    );
  };

  // Dashboard View Renderer
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
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(incomeTotal)}
            </p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="flex items-center mb-2">
              <CreditCard className="text-red-500 mr-2" size={20} />
              <span className="text-sm font-medium">Total Expenses</span>
            </div>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(expenseTotal)}
            </p>
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
                    <p className="text-xs text-gray-500">
                      {transaction.date} | {transaction.category}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
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
                        style={{ width: `${(amount / expenseTotal) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-sm font-medium ml-4">
                    {formatCurrency(amount)}
                  </p>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No expense data available.</p>
        )}
        <h4 className="text-md font-medium mt-6 mb-3">Imported Files</h4>
        <div className="overflow-auto max-h-36">
          <ul className="divide-y divide-gray-200">
            {Object.entries(fileNames.reduce((acc, file) => {
              const filtered = transactions.filter((t) => t.source === file.name);
              acc[file.name] = {
                count: filtered.length,
                income: filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
                expenses: filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
              };
              return acc;
            }, {})).map(([file, stats], index) => (
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

  // Category Management Renderer
  const renderCategories = () => {
    const handleCategoryEdit = (originalCategory, newCategory) => {
      setEditedCategories((prev) => ({
        ...prev,
        [originalCategory]: newCategory,
      }));
    };

    const handleSaveCategories = () => {
      setIsSavingCategories(true);
      const updatedTransactions = transactions.map((transaction) => {
        const newCategory = editedCategories[transaction.category];
        if (newCategory) {
          return { ...transaction, category: newCategory };
        }
        return transaction;
      });
      setTransactions(updatedTransactions);
      setEditedCategories({});
      setIsSavingCategories(false);
    };

    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-medium mb-1">Category Management</h3>
            <p className="text-sm text-gray-500">
              Edit category labels and update all transactions
            </p>
          </div>
          {Object.keys(editedCategories).length > 0 && (
            <button
              onClick={handleSaveCategories}
              disabled={isSavingCategories}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              {isSavingCategories ? (
                <span>Saving...</span>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {uniqueCategories
            .filter((category) => category !== 'all')
            .map((category) => (
              <div
                key={category}
                className="p-4 border rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">
                    Original Category:
                    <span className="ml-2 text-gray-900">{category}</span>
                  </label>
                  <div>
                    <input
                      type="text"
                      value={editedCategories[category] || category}
                      onChange={(e) => handleCategoryEdit(category, e.target.value)}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter new category name"
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    {
                      transactions.filter((t) => t.category === category)
                        .length
                    }{' '}
                    transactions
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  };

  // Transactions Renderer with filtering
  const renderTransactions = () => {
    const filteredTransactions = transactions.filter((t) => {
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      const matchesSource = sourceFilter === 'all' || t.source === sourceFilter;
      return matchesCategory && matchesSource;
    });

    const filteredTotal = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const filteredIncome = filteredTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const filteredExpenses = filteredTransactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <h3 className="text-lg font-medium">
            All Transactions ({filteredTransactions.length})
          </h3>
          <div className="flex flex-wrap gap-4 mt-2 md:mt-0">
            <div className="flex items-center text-sm">
              <span className="text-green-600 font-medium mr-4">
                Income: {formatCurrency(filteredIncome)}
              </span>
              <span className="text-red-600 font-medium mr-4">
                Expenses: {formatCurrency(filteredExpenses)}
              </span>
              <span
                className={`font-medium ${
                  filteredTotal >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                Net: {formatCurrency(filteredTotal)}
              </span>
            </div>
          </div>
        </div>
        <ExclusionSummary />
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex items-center">
            <label className="mr-2 text-sm font-medium text-gray-700">
              Category:
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="p-2 border rounded text-sm"
            >
              {uniqueCategories.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center">
            <label className="mr-2 text-sm font-medium text-gray-700">
              Source:
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="p-2 border rounded text-sm"
            >
              {uniqueSources.map((source) => (
                <option key={source} value={source}>
                  {source === 'all' ? 'All Sources' : source}
                </option>
              ))}
            </select>
          </div>
          {(categoryFilter !== 'all' || sourceFilter !== 'all') && (
            <button
              onClick={() => {
                setCategoryFilter('all');
                setSourceFilter('all');
              }}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200 flex items-center"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Clear Filters
            </button>
          )}
        </div>
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
              {filteredTransactions.map((transaction) => (
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
  };

  // Debug Information Renderer
  const renderDebug = () => (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-medium mb-4">Debug Information</h3>
      <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
        {debugInfo}
      </pre>
    </div>
  );

  // -----------------------------
  // Event Handler Functions (using useCallback)
  // -----------------------------
  const toggleTransactionExclusion = useCallback((transactionId) => {
    setExcludedTransactions((prev) =>
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId]
    );
  }, []);

  const handleEditClick = useCallback((transaction) => {
    setEditingTransaction(transaction.id);
    setEditFormData({
      date: transaction.date,
      description: transaction.description,
      category: transaction.category,
      amount: transaction.amount,
    });
  }, []);

  const handleEditChange = useCallback((field, value) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleEditSave = useCallback((transactionId) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, ...editFormData } : t))
    );
    setEditingTransaction(null);
    setEditFormData({});
  }, [editFormData]);

  const handleEditCancel = useCallback(() => {
    setEditingTransaction(null);
    setEditFormData({});
  }, []);

  const handleEndingBalanceChange = useCallback((month, value) => {
    setEndingBalances((prev) => ({
      ...prev,
      [month]: parseFloat(value) || 0,
    }));
  }, []);

  // -----------------------------
  // NEW: Source Files Management Functions
  // -----------------------------
  const handleAccountTypeChange = useCallback((fileName, accountType) => {
    setFileNames((prevFiles) =>
      prevFiles.map((file) =>
        file.name === fileName ? { ...file, accountType } : file
      )
    );
  }, []);

  const handleSaveSourceFiles = useCallback(() => {
    localStorage.setItem('sourceFiles', JSON.stringify(fileNames));
    setMessage("Source files saved successfully.");
  }, [fileNames]);

  const handleLoadSourceFiles = useCallback(() => {
    const loadedFiles = localStorage.getItem('sourceFiles');
    if (loadedFiles) {
      const savedFiles = JSON.parse(loadedFiles);
      setFileNames(savedFiles);
      setMessage("Source files loaded successfully!");
  
      // Process each saved file
      savedFiles.forEach((file) => {
        const fileContent = localStorage.getItem(`fileContent_${file.name}`);
        if (fileContent) {
          try {
            // Parse the file content as CSV
            Papa.parse(fileContent, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: true,
              complete: (results) => {
                if (results.data && results.data.length > 0) {
                  const processedData = processTransactions(results.data, file.name);
                  setTransactions((prevTransactions) => {
                    const combinedTransactions = [...prevTransactions, ...processedData];
                    const uniqueTransactions = removeDuplicates(combinedTransactions);
                    return uniqueTransactions;
                  });
                } else {
                  console.warn(`No valid data found in file: ${file.name}`);
                  setError(`No valid data found in file: ${file.name}`);
                }
              },
              error: (error) => {
                console.error(`Error parsing file ${file.name}:`, error);
                setError(`Error parsing file: ${file.name}`);
              },
            });
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            setError(`Error processing file: ${file.name}`);
          }
        } else {
          console.warn(`No content found for file: ${file.name}`);
          setError(`No content found for file: ${file.name}`);
        }
      });
    } else {
      setMessage("No saved source files found.");
    }
  }, [setFileNames, setTransactions, setMessage, setError]);

  const ExclusionSummary = () => {
    const excludedAmount = transactions
      .filter((t) => excludedTransactions.includes(t.id))
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

  // CSV Export Functionality
  const saveTransactionsToFile = useCallback(() => {
    // Build enhanced metadata including additional state fields.
    const metadata = {
      endingBalances,       // Existing ending balance data.
      editedCategories,     // Newly included category editing info.
      sourceFiles: fileNames, // Include source files information.
      exportDate: new Date().toISOString(),
    };
  
    // Define CSV header columns.
    const headers = ['date', 'description', 'category', 'amount', 'source'];
  
    // Create CSV rows from transactions.
    const csvRows = transactions.map((t) =>
      [
        t.date,
        `"${t.description.replace(/"/g, '""')}"`,
        `"${t.category.replace(/"/g, '""')}"`,
        t.amount,
        `"${t.source.replace(/"/g, '""')}"`,
      ].join(',')
    );
  
    // Prepend the metadata as a commented first line.
    const csvContent = [
      '# METADATA=' + JSON.stringify(metadata),
      headers.join(','),
      ...csvRows,
    ].join('\n');
  
    // Create a Blob and trigger a download.
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `combined_transactions_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [transactions, endingBalances, editedCategories, fileNames]);  

  const renderHeaderActions = () => (
    <div className="flex gap-4 mt-4">
      <button
        onClick={saveTransactionsToFile}
        disabled={transactions.length === 0}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        Export Combined Data
      </button>
    </div>
  );

  // -----------------------------
  // Source Files Renderer
  // -----------------------------
  const renderSourceFiles = () => {
    const handleFileInputClick = () => {
      const fileInput = document.getElementById('file-upload-input');
      if (fileInput) {
        fileInput.click();
      }
    };

    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Source Files</h3>
        <p className="text-sm text-gray-500 mb-6">
          Upload and manage your source files. Mark them as Personal or Business accounts, and save them for future use.
        </p>
        <div className="mb-4">
          <button
            onClick={handleFileInputClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Select and Upload Files
          </button>
          <input
            id="file-upload-input"
            type="file"
            multiple
            accept=".csv"
            onChange={handleFileUploadWithMetadata}
            className="mt-2 block w-full text-sm text-gray-500 border border-gray-300 rounded p-2"
          />
          {loading && <p className="text-sm text-gray-500 mt-2">Processing files...</p>}
          {message && <p className="text-sm text-blue-500 mt-2">{message}</p>}
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>
        {fileNames.length > 0 ? (
          <div className="space-y-4">
            {fileNames.map((file) => (
              <div
                key={file.name}
                className="p-4 border rounded-lg flex justify-between items-center"
              >
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {transactions.filter((t) => t.source === file.name).length} transactions
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">
                    Account Type:
                  </label>
                  <select
                    value={file.accountType || 'Personal'}
                    onChange={(e) =>
                      handleAccountTypeChange(file.name, e.target.value)
                    }
                    className="p-2 border rounded text-sm"
                  >
                    <option value="Personal">Personal</option>
                    <option value="Business">Business</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No source files uploaded yet.</p>
        )}
        <div className="mt-6 flex gap-4">
          <button
            onClick={handleSaveSourceFiles}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Save Source Files
          </button>
          <button
            onClick={handleLoadSourceFiles}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Load Source Files
          </button>
        </div>
      </div>
    );
  };

  // -----------------------------
  // Main Render
  // -----------------------------
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Multi-Statement Budget App
            </h1>
            <p className="text-gray-600">
              Upload multiple CSV files to analyze your combined financial data
            </p>
          </div>
          {renderHeaderActions()}
        </div>
      </header>
      <div className="mb-6">
        <div className="border-b border-gray-200 mb-4">
          <nav className="flex -mb-px">
            {['dashboard', 'current', 'forecast', 'transactions', 'categories', 'sourceFiles'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-4 text-sm font-medium ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>
      {activeTab === 'sourceFiles' ? (
        // Always show the source files view regardless of transactions length
        renderSourceFiles()
      ) : transactions.length > 0 ? (
        activeTab === 'dashboard'
          ? renderDashboard()
          : activeTab === 'current'
          ? renderCurrent()
          : activeTab === 'forecast'
          ? renderForecast()
          : activeTab === 'transactions'
          ? renderTransactions()
          : activeTab === 'categories'
          ? renderCategories()
          : null
      ) : (
        <div className="p-6 bg-white rounded-lg shadow text-center">
          <FileText className="mx-auto text-gray-400 mb-4" size={64} />
          <p className="text-gray-500">
            No transactions to display. Upload multiple CSV statements to get started.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            You can upload bank statements, credit card statements, and other financial CSVs.
          </p>
        </div>
      )}
    </div>
  );
};

export default MultiStatementBudget;
